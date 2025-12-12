import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './Favorites.css';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace(/\/$/, '');
const API_KEY = process.env.REACT_APP_API_KEY;

type Listing = {
  id: number;
  title: string;
  description: string;
  location: string | null;
  created_at: string;
  type_id?: number;
  author_username?: string;
  primary_image?: string | null;
  primaryImage?: string | null;
  image_url?: string | null;
  main_image?: string | null;
  author_avatar_url?: string | null;
};

const getDefaultIconForType = (typeId?: number) => {
  if (typeId === 3) return '/icons/work-case-filled-svgrepo-com.svg';
  if (typeId === 2) return '/icons/hands-holding-heart-svgrepo-com.svg';
  return null;
};

const getInitials = (name?: string | null) => {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) ?? '';
  return (first + second).toUpperCase();
};

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

const Favorites: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  const handleToggleFavorite = async (
    e: React.MouseEvent,
    listingId: number,
    isCurrentlyFavorite: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const method = isCurrentlyFavorite ? 'DELETE' : 'POST';
      const res = await fetch(`${API_BASE}/api/listings/favorites/${listingId}`, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      });

      if (!res.ok) {
        console.error('Błąd zmiany ulubionych:', await res.text());
        return;
      }

      setFavoriteIds((prev) =>
        isCurrentlyFavorite ? prev.filter((id) => id !== listingId) : [...prev, listingId]
      );

      if (isCurrentlyFavorite) {
        setFavorites((prev) => prev.filter((l) => l.id !== listingId));
      }
    } catch (err) {
      console.error('Błąd podczas zmiany ulubionych:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/favorites`, {
          credentials: 'include',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });

        if (!res.ok) {
          console.error('Błąd pobierania ulubionych:', await res.text());
          return;
        }

        const data = await res.json();

        const withImages = await Promise.all(
          data.map(async (it: any) => {
            const existingPrimary = it.primary_image || it.primaryImage || it.image_url || it.main_image;
            const authorAvatar = it.author_avatar_url || it.author_avatar || it.authorAvatarSrc || null;

            if (existingPrimary) {
              return { ...it, primary_image: existingPrimary, author_avatar_url: authorAvatar };
            }

            const first = await fetchFirstImageFor(it.id);
            return { ...it, primary_image: first, author_avatar_url: authorAvatar };
          })
        );

        setFavoriteIds(withImages.map((l: any) => l.id));
        setFavorites(withImages);
      } catch (e) {
        console.error('Błąd pobierania ulubionych:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="favorites-page">
        <h2>Moje ulubione ogłoszenia</h2>
        <p>Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <h2>Moje ulubione ogłoszenia</h2>

      {favorites.length === 0 ? (
        <p>Nie masz jeszcze żadnych ulubionych ogłoszeń.</p>
      ) : (
        <div className="favorites-grid">
          {favorites.map((listing) => {
            const isFav = favoriteIds.includes(listing.id);

            return (
              <Link key={listing.id} to={`/listing/${listing.id}`} className="favorites-card">
                <button
                  className={`favorite-toggle ${isFav ? 'favorite-toggle--active' : ''}`}
                  aria-label={isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                  onClick={(e) => handleToggleFavorite(e, listing.id, isFav)}
                >
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12.01 6.001C6.5 1 1 8 5.782 13.001L12.011 20l6.23-7C23 8 17.5 1 12.01 6.002Z"
                    />
                  </svg>
                </button>

                <div className="favorites-thumb-space">
                  {listing.primary_image ? (
                    <img
                      className="favorites-thumb"
                      src={
                        listing.primary_image.startsWith('data:') || listing.primary_image.startsWith('http')
                          ? listing.primary_image
                          : `${API_BASE}${listing.primary_image}`
                      }
                      alt={listing.title}
                    />
                  ) : getDefaultIconForType(listing.type_id) ? (
                    <img
                      className="favorites-thumb favorites-thumb--icon"
                      src={getDefaultIconForType(listing.type_id)!}
                      alt="Ikona ogłoszenia"
                    />
                  ) : (
                    <div className="favorites-thumb-fallback" aria-hidden="true">
                      <svg className="favorites-thumb-fallback-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>

                <h3 className="favorites-title">{listing.title}</h3>
                <p className="favorites-description">{listing.description}</p>

                <div className="favorites-footer">
                  <div className="favorites-author">
                    <Link
                      to={`/profile/${listing.author_username ?? ''}`}
                      className="favorites-author-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="mini-avatar" aria-hidden="true">
                        {listing.author_avatar_url ? (
                          <img
                            src={
                              listing.author_avatar_url.startsWith('http') || listing.author_avatar_url.startsWith('data:')
                                ? listing.author_avatar_url
                                : `${API_BASE}${listing.author_avatar_url}`
                            }
                            alt={`Avatar użytkownika ${listing.author_username ?? ''}`}
                            className="mini-avatar-img"
                          />
                        ) : (
                          getInitials(listing.author_username)
                        )}
                      </span>
                      <span className="favorites-author-name">{listing.author_username ?? 'nieznany'}</span>
                    </Link>
                  </div>

                  <div className="favorites-meta">
                    <span>{listing.location ?? ''}</span>
                    <span>{new Date(listing.created_at).toLocaleDateString('pl-PL')}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Favorites;
