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
  primary_image?: string | null;
  is_featured?: boolean; 
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

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
  const { user, loading, logout, setUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const navigate = useNavigate();


  useEffect(() => {
    if (!user) return;

    // ---------- Twoje ogłoszenia ----------
    const fetchListings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/my`, {
          credentials: 'include',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
          console.error('Niepoprawna odpowiedź API (my):', data);
          return;
        }

        const withImages: Listing[] = await Promise.all(
          data.map(async (item: any) => {
            // Spróbuj pobrać pierwsze zdjęcie z osobnego endpointu
            const primary =
              (item.primary_image as string | null) ??
              (await fetchFirstImageFor(item.id));

            return {
              ...item,
              primary_image: primary ?? null,
            };
          })
        );

        setListings(withImages);
      } catch (err) {
        console.error('Błąd pobierania ogłoszeń:', err);
      } finally {
        setLoadingListings(false);
      }
    };

    // ---------- Ulubione ----------
    const fetchFavorites = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/favorites`, {
          credentials: 'include',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
          console.error('Niepoprawna odpowiedź API (favorites):', data);
          return;
        }

        const withImages: Listing[] = await Promise.all(
          data.map(async (item: any) => {
            const primary =
              (item.primary_image as string | null) ??
              (await fetchFirstImageFor(item.id));

            return {
              ...item,
              primary_image: primary ?? null,
            };
          })
        );

        setFavorites(withImages);
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

  const handleToggleFeatured = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}/featured`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Błąd wyróżniania ogłoszenia:', err);
        alert(err.error || 'Nie udało się zmienić wyróżnienia.');
        return;
      }

      const data = await res.json();

      setListings(prev =>
        prev.map(l =>
          l.id === id ? { ...l, is_featured: data.is_featured } : l
        )
      );
    } catch (e) {
      console.error('Błąd żądania wyróżnienia:', e);
      alert('Wystąpił błąd po stronie klienta.');
    }
  };



  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2 className="profile-title">Profil użytkownika</h2>


        <div className="profile-top">
          {/* LEWA STRONA — avatar + dane */}
          <div className="profile-left">
            <div className="profile-avatar">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="80"
                height="80"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-7 8a7 7 0 1 1 14 0H5Z"
                />
              </svg>
            </div>

            <div className="profile-user-data">
              <p className="profile-username">{user.username}</p>
              <p>
                <strong>Imię i nazwisko:</strong> {user.first_name}{' '}
                {user.last_name}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Data rejestracji:</strong>{' '}
                {new Date(user.created_at || '').toLocaleDateString()}
              </p>
              <p>
                <strong>Punkty:</strong> {user.points ?? 0}
              </p>
            </div>
          </div>

          {/* PRAWA STRONA — kafelki + przycisk */}
          <div className="profile-right">
            <div className="profile-counters">
              <div>
                <strong>{listings.length}</strong>
                <span>ogłoszeń</span>
              </div>
              <div>
                <strong>{favorites.length}</strong>
                <span>ulubione</span>
              </div>
              <div>
                <strong>{user.points ?? 0}</strong>
                <span>punktów</span>
              </div>
            </div>

            <button
              className="profile-rewards-button"
              onClick={() => navigate('/rewards')}
            >
              Zobacz nagrody za punkty
            </button>

            <button
              className="profile-add-listing-button"
              onClick={() => navigate('/listings/create')}   
            >
              Dodaj ogłoszenie
            </button>
          </div>
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
              const imgSrc = l.primary_image || null;

              return (
                <div key={l.id} className="listing-card">
                  <div
                    className="listing-main"
                    onClick={() =>
                      navigate(`/listing/${l.id}`, {
                        state: { fromProfile: true },
                      })
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    {imgSrc ? (
                      <div className="listing-thumb">
                        <img src={imgSrc} alt={l.title} />
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

                  <div className="listing-actions">
                    <button
                      className={`feature-button ${l.is_featured ? 'feature-button--active' : ''}`}
                      onClick={() => handleToggleFeatured(l.id)}
                    >
                      {l.is_featured ? 'Usuń wyróżnienie' : 'Wyróżnij'}
                    </button>

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
                          state: { fromProfile: true, editMode: true },
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
            {favorites.map((f) => {
              const imgSrc = f.primary_image || null;

              return (
                <div key={f.id} className="listing-card">
                  <div
                    className="listing-main"
                    onClick={() => navigate(`/listing/${f.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {imgSrc ? (
                      <div className="listing-thumb">
                        <img src={imgSrc} alt={f.title} />
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

                    <div className="listing-content">
                      <h4 className="listing-title">{f.title}</h4>
                      <p className="listing-desc">{f.description}</p>
                      <small className="listing-date">
                        Dodano: {new Date(f.created_at).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}


      </div>
    </div>
  );
};

export default Profile;
