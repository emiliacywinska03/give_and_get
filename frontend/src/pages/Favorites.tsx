import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import './Profile.css';
type Listing = {
  id: number;
  title: string;
  description: string;
  created_at: string;
};

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';

const Favorites: React.FC = () => {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const fetchFavs = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_BASE}/api/listings/favorites`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setItems(data);
        else console.error('Błędna odpowiedź z API (favorites):', data);
      } catch (e) {
        console.error('Błąd pobierania ulubionych:', e);
      } finally {
        setPending(false);
      }
    };
    fetchFavs();
  }, [user]);

  if (loading) return <p>Ładowanie…</p>;
  if (!user) return <p>Musisz być zalogowana/y.</p>;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2 className="profile-title">Moje ulubione ogłoszenia</h2>
        {pending ? (
          <p>Ładowanie ulubionych…</p>
        ) : items.length === 0 ? (
          <p>Nie masz jeszcze ulubionych ogłoszeń.</p>
        ) : (
          <div className="listing-grid">
            {items.map((l) => (
              <div key={l.id} className="listing-card">
                <h4 className="listing-title">{l.title}</h4>
                <p className="listing-desc">{l.description}</p>
                <small className="listing-date">
                  Dodano: {new Date(l.created_at).toLocaleDateString()}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;