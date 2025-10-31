import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

interface Listing {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';

const Profile: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchListings = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_BASE}/api/listings/my`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setListings(data);
        } else {
          console.error('Niepoprawna odpowiedź API:', data);
        }
      } catch (err) {
        console.error('Błąd pobierania ogłoszeń:', err);
      } finally {
        setLoadingListings(false);
      }
    };
    fetchListings();

    const fetchFavorites = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_BASE}/api/listings/favorites`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setFavorites(data);
        } else {
          console.error('Niepoprawna odpowiedź API (favorites):', data);
        }
      } catch (err) {
        console.error('Błąd pobierania ulubionych ogłoszeń:', err);
      } finally {
        setLoadingFavorites(false);
      }
    };
    fetchFavorites();
  }, [user]);

  if (loading) return <p>Ładowanie danych użytkownika...</p>;
  if (!user) return <p>Nie jesteś zalogowany.</p>;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2 className="profile-title">Profil użytkownika</h2>

        <div className="profile-info">
          <p className="profile-username">{user.username}</p>
          <p><strong>Imię i nazwisko:</strong> {user.first_name} {user.last_name}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Data rejestracji:</strong> {new Date(user.created_at || '').toLocaleDateString()}</p>
          <button
            onClick={async () => { await logout(); navigate('/'); }}
            className="btn btn-logout"
          >
            Wyloguj
          </button>
        </div>

        <h3 className="profile-subtitle">Twoje ogłoszenia</h3>
        {loadingListings ? (
          <p>Ładowanie ogłoszeń...</p>
        ) : listings.length === 0 ? (
          <p>Nie masz jeszcze żadnych ogłoszeń.</p>
        ) : (
          <div className="listing-grid">
            {listings.map((l) => (
              <div
                key={l.id}
                className="listing-card"
              >
                <h4 className="listing-title">{l.title}</h4>
                <p className="listing-desc">{l.description}</p>
                <p><strong>Autor:</strong> {user.username}</p>
                <small className="listing-date">Dodano: {new Date(l.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        )}
        <h3 className="profile-subtitle">Moje ulubione ogłoszenia</h3>
        {loadingFavorites ? (
          <p>Ładowanie ulubionych…</p>
        ) : favorites.length === 0 ? (
          <p>Nie masz jeszcze ulubionych ogłoszeń.</p>
        ) : (
          <div className="listing-grid">
            {favorites.map((f) => (
              <div key={f.id} className="listing-card">
                <h4 className="listing-title">{f.title}</h4>
                <p className="listing-desc">{f.description}</p>
                <small className="listing-date">Dodano: {new Date(f.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;