import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  created_at: string;
  images?: any[];
  primary_image?: any;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

const toImageSrc = (val: any): string | null => {
  if (!val) return null;

  if (typeof val === 'string') {
    if (val.startsWith('http') || val.startsWith('data:')) return val;
    return `${API_BASE}${val}`;
  }

  if (typeof val === 'object') {
    const candidate = val.dataUrl || val.url || val.path;
    if (!candidate) return null;
    if (candidate.startsWith('http') || candidate.startsWith('data:')) return candidate;
    return `${API_BASE}${candidate}`;
  }

  return null;
};


async function fetchFirstImageFor(listingId: number): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
      credentials: 'include',
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    });
    if (!r.ok) return null;
    const imgs: { id: number; dataUrl: string }[] = await r.json();
    return imgs.length ? imgs[0].dataUrl : null;
  } catch {
    return null;
  }
}


const Profile: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
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

          const thumbMap: Record<number, string> = {};

          for (const item of data) {
            const direct =
              toImageSrc(item.primary_image) ||
              (Array.isArray(item.images) ? toImageSrc(item.images[0]) : null);

            if (direct) {
              thumbMap[item.id] = direct;
              continue;
            }

            try {
              const ri = await fetch(`${API_BASE}/api/listings/${item.id}/images`, {
                headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
                credentials: 'include',
              });

              if (ri.ok) {
                const imgs = await ri.json();
                if (Array.isArray(imgs)) {
                  const first = imgs
                    .map((it: any) =>
                      toImageSrc(it) ||
                      toImageSrc(it?.dataUrl) ||
                      toImageSrc(it?.url) ||
                      toImageSrc(it?.path)
                    )
                    .find((x: string | null): x is string => Boolean(x));

                  if (first) {
                    thumbMap[item.id] = first;
                  }
                }
              }
            } catch (e) {
              console.error('Błąd pobierania miniatury dla ogłoszenia', item.id, e);
            }
          }

          setThumbnails(thumbMap);
        } else {
          console.error('Niepoprawna odpowiedź API:', data);
        }
      } catch (err) {
        console.error('Błąd pobierania ogłoszeń:', err);
      } finally {
        setLoadingListings(false);
      }
    };

    const fetchFavorites = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_BASE}/api/listings/favorites`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          const withImages = await Promise.all(
            data.map(async (it: any) => {
              if (it.primary_image) return it;
              const first = await fetchFirstImageFor(it.id);
              return { ...it, primary_image: first };
            })
          );
          setFavorites(withImages);
        } else {
          console.error('Niepoprawna odpowiedź API (favorites):', data);
        }
        
      } catch (err) {
        console.error('Błąd pobierania ulubionych ogłoszeń:', err);
      } finally {
        setLoadingFavorites(false);
      }
    };

    fetchListings();
    fetchFavorites();
  }, [user]);


  const handleDelete = async (id: number) => {
    const confirmed = window.confirm('Czy na pewno chcesz usunąć ogłoszenie?');
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}`, {
        method: 'DELETE',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        credentials: 'include',
      });

      if (res.ok) {
        setListings((prev) => prev.filter((item) => item.id !== id));
      } else {
        const error = await res.json();
        alert(`Błąd: ${error.error}`);
      }
    } catch (err) {
      console.error('Błąd podczas usuwania ogłoszenia:', err);
      alert('Wystąpił błąd podczas usuwania ogłoszenia.');
    }
  };

  if (loading) return <p>Ładowanie danych użytkownika...</p>;
  if (!user) return <p>Nie jesteś zalogowany.</p>;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2 className="profile-title">Profil użytkownika</h2>

        <div className="profile-info">
          <p className="profile-username">{user.username}</p>
          <p>
            <strong>Imię i nazwisko:</strong> {user.first_name} {user.last_name}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Data rejestracji:</strong>{' '}
            {new Date(user.created_at || '').toLocaleDateString()}
          </p>
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="btn btn-logout"
          >
            Wyloguj
          </button>
        </div>
        {/* ---------------- Twoje ogłoszenia ---------------- */}
        <h3 className="profile-subtitle">Twoje ogłoszenia</h3>
        {loadingListings ? (
          <p>Ładowanie ogłoszeń...</p>
        ) : listings.length === 0 ? (
          <p>Nie masz jeszcze żadnych ogłoszeń.</p>
        ) : (
          <div className="listing-grid">
            {listings.map((l) => {
              const imgSrc = thumbnails[l.id];

              return (
                <div key={l.id} className="listing-card">
                  {/* Lewa część – kliknięcie otwiera szczegóły */}
                  <div
                    className="listing-main"
                    onClick={() =>
                      navigate(`/listing/${l.id}`, {
                        state: { fromProfile: true }, // info, że przyszliśmy z profilu
                      })
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    {imgSrc && (
                      <div className="listing-thumb">
                        <img src={imgSrc} alt={l.title} />
                      </div>
                    )}

                    <div className="listing-content">
                      <h4 className="listing-title">{l.title}</h4>
                      <p className="listing-desc">{l.description}</p>
                      <p>
                        <strong>Autor:</strong> {user.username}
                      </p>
                      <small className="listing-date">
                        Dodano: {new Date(l.created_at).toLocaleDateString()}
                      </small>
                    </div>
                  </div>

                  {/* Prawa część – przyciski */}
                  <div className="listing-actions">
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(l.id)}
                    >
                      Usuń
                    </button>
                    <button
                      className="edit-button"
                      onClick={() =>
                        navigate(`/listing/${l.id}`, {
                          state: { fromProfile: true, editMode: true }, // od razu tryb edycji
                        })
                      }
                    >
                      Edytuj
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------------- Ulubione ---------------- */}
        <h3 className="profile-subtitle">Moje ulubione ogłoszenia</h3>
        {loadingFavorites ? (
          <p>Ładowanie ulubionych…</p>
        ) : favorites.length === 0 ? (
          <p>Nie masz jeszcze ulubionych ogłoszeń.</p>
        ) : (
          <div className="listing-grid">
            {favorites.map((f) => (
              <div
                key={f.id}
                className="listing-card"
                onClick={() => navigate(`/listing/${f.id}`)}
                style={{ cursor: 'pointer' }}
              >
                {/* miniatura po lewej */}
                {f.primary_image && (
                  <div className="listing-thumb">
                    <img
                      src={
                        f.primary_image.startsWith('data:')
                          ? f.primary_image
                          : `${API_BASE}${f.primary_image}`
                      }
                      alt={f.title}
                    />
                  </div>
                )}

                {/* treść po prawej */}
                <div className="listing-content">
                  <h4 className="listing-title">{f.title}</h4>
                  <p className="listing-desc">{f.description}</p>
                  <small className="listing-date">
                    Dodano: {new Date(f.created_at).toLocaleDateString('pl-PL')}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Profile;