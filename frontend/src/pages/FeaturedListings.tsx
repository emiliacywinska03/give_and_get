import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './FeaturedListings.css';
import { useAuth } from '../auth/AuthContext';

const API_BASE =
  (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace(/\/$/, '');
const API_KEY = process.env.REACT_APP_API_KEY;

interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  created_at: string;
  user_id: number;
  type_id?: number;
  author_username?: string;
  author_avatar_url?: string | null;
  primary_image?: string | null;
  is_featured?: boolean;
}

async function fetchFirstImageFor(listingId: number): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
      credentials: 'include',
    });
    if (!r.ok) return null;
    const imgs: any[] = await r.json();
    if (!imgs.length) return null;

    const first = imgs[0];
    return first.path || null;
  } catch {
    return null;
  }
}

const getDefaultIconForType = (typeId?: number) => {
  if (typeId === 3) return "/icons/work-case-filled-svgrepo-com.svg";
  if (typeId === 2) return "/icons/hands-holding-heart-svgrepo-com.svg";
  return null;
};


const resolveImgSrc = (primary?: string | null) => {
  if (!primary) return null;
  if (primary.startsWith('data:')) return primary;
  if (primary.startsWith('http')) return primary;
  return `${API_BASE}${primary}`;
};

const truncateDescription = (text?: string, max = 120) => {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
};

const FeaturedListings: React.FC = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings?limit=50&page=1`, {
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        if (!res.ok) {
          console.error(
            'Błąd odpowiedzi /listings:',
            res.status,
            res.statusText
          );
          setListings([]);
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          console.error('Nieprawidłowy format danych z /listings', data);
          setListings([]);
          return;
        }
        const onlyFeatured = data.filter((l: any) => l.is_featured);

        // jeśli użytkownik jest zalogowany – pokaż tylko jego wyróżnione
        const mine = user
          ? onlyFeatured.filter((l: any) => l.user_id === user.id)
          : onlyFeatured;

        const normalized: Listing[] = await Promise.all(
          mine.map(async (it: any) => {
            let primary =
              it.primary_image ??
              it.primaryImage ??
              it.image_url ??
              it.main_image ??
              null;

            if (!primary) {
              const first = await fetchFirstImageFor(it.id);
              primary = first;
            }

            return {
              ...it,
              type_id: it.type_id,
              primary_image: primary,
              author_avatar_url:
                it.author_avatar_url || it.author_avatar || it.authorAvatarSrc || null,
            } as Listing;
          })
        );

        setListings(normalized);
      } catch (e) {
        console.error('Błąd pobierania wyróżnionych:', e);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  return (
    <div className="listing-page">
      <h2>Moje wyróżnione ogłoszenia</h2>

      {loading ? (
        <p>Ładowanie…</p>
      ) : listings.length === 0 ? (
        <p>Nie masz jeszcze wyróżnionych ogłoszeń.</p>
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => {
            const authorAvatarSrc = listing.author_avatar_url
              ? listing.author_avatar_url.startsWith('http') ||
                listing.author_avatar_url.startsWith('data:')
                ? listing.author_avatar_url
                : `${API_BASE}${listing.author_avatar_url}`
              : null;

            return (
              <div key={listing.id} className="listing-card">

              {listing.is_featured && (
                <div
                  className="featured-badge"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="#FACC15"
                  >
                    <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.173L12 18.896l-7.336 3.874 1.402-8.173L.132 9.21l8.2-1.192z" />
                  </svg>
                </div>
              )}
            
              <Link
                to={`/listing/${listing.id}`}
                className="listing-link"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="listing-thumb-wrapper">
                  {resolveImgSrc(listing.primary_image) ? (
                    <img
                      className="listing-thumb"
                      src={resolveImgSrc(listing.primary_image)!}
                      alt={listing.title}
                    />
                  ) : getDefaultIconForType(listing.type_id) ? (
                    <div className="listing-thumb-space">
                      <img
                        className="listing-thumb"
                        src={getDefaultIconForType(listing.type_id)!}
                        alt="Ikona ogłoszenia"
                        style={{ objectFit: 'contain', padding: '12px' }}
                      />
                    </div>
                  ) : (
                    <div className="listing-thumb-space">
                      <svg
                        className="listing-thumb-placeholder-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="3"
                          ry="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M7 7l10 10M17 7L7 17"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
            
                <h3 className="listing-title">{listing.title}</h3>
                <p className="listing-description">
                  {truncateDescription(listing.description, 120)}
                </p>
                <p className="listing-author">
                  <span className="mini-avatar">
                    {authorAvatarSrc ? (
                      <img
                        src={authorAvatarSrc}
                        alt={`Avatar użytkownika ${listing.author_username ?? ''}`}
                        className="mini-avatar-img"
                      />
                    ) : (
                      (listing.author_username || 'U')[0].toUpperCase()
                    )}
                  </span>
                  Autor: {listing.author_username ?? 'nieznany'}
                </p>
                <p className="listing-location">Lokalizacja: {listing.location}</p>
                <small className="listing-date">
                  Dodano: {new Date(listing.created_at).toLocaleDateString()}
                </small>
              </Link>
            </div>
            
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeaturedListings;
