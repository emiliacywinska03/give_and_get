import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './ListingPage.css';
import { useAuth } from '../auth/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  created_at: string;
  user_id: number;
  author_username?: string;
  primary_image?: string | null;
  is_featured?: boolean;
}

const FeaturedListings: React.FC = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/featured`, {
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        const data = await res.json();
        if (!Array.isArray(data)) return;

        // jeśli użytkownik jest zalogowany – pokaż tylko jego wyróżnione
        const mine = user
          ? data.filter((l: any) => l.user_id === user.id)
          : data;

        setListings(mine);
      } catch (e) {
        console.error('Błąd pobierania wyróżnionych:', e);
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
          {listings.map((listing) => (
            <div key={listing.id} className="listing-card">

            {/* Wyróżnienie — gwiazdka */}
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
                {listing.primary_image ? (
                  <img
                    className="listing-thumb"
                    src={listing.primary_image}
                    alt={listing.title}
                  />
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
              <p className="listing-location">Lokalizacja: {listing.location}</p>
              <small className="listing-date">
                Dodano: {new Date(listing.created_at).toLocaleDateString()}
              </small>
            </Link>
          </div>
          
          ))}
        </div>
      )}
    </div>
  );
};

export default FeaturedListings;
