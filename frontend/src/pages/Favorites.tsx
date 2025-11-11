import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './Favorites.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type Listing = {
  id: number;
  title: string;
  description: string;
  location: string | null;
  created_at: string;
  author_username?: string;
  primary_image?: string | null;
};

async function fetchFirstImageFor(listingId: number): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
      credentials: 'include',
    });
    if (!r.ok) return null;
    const imgs: { id: number; dataUrl: string }[] = await r.json();
    return imgs.length ? imgs[0].dataUrl : null;
  } catch {
    return null;
  }
}

const Favorites: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

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
            if (it.primary_image) return it;
            const first = await fetchFirstImageFor(it.id);
            return { ...it, primary_image: first };
          })
        );

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
        <div className="favorites-list">
          {favorites.map((listing) => (
            <Link
              key={listing.id}
              to={`/listing/${listing.id}`}
              className="favorites-item"
            >
              <div className="favorites-thumb-wrapper">
                {listing.primary_image ? (
                  <img
                    className="favorites-thumb"
                    src={
                      listing.primary_image.startsWith('data:')
                        ? listing.primary_image
                        : `${API_BASE}${listing.primary_image}`
                    }
                    alt={listing.title}
                  />
                ) : (
                  <div className="favorites-thumb-placeholder" />
                )}
              </div>

              <div className="favorites-content">
                <h3 className="favorites-title">{listing.title}</h3>
                <p className="favorites-description">
                  {listing.description}
                </p>
                <p className="favorites-meta">
                  <span>Autor: {listing.author_username ?? 'nieznany'}</span>
                  {listing.location && (
                    <span> • Lokalizacja: {listing.location}</span>
                  )}
                  <span>
                    {' '}
                    • Dodano:{' '}
                    {new Date(listing.created_at).toLocaleDateString('pl-PL')}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
