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
  status_id?: number | null;   
  type_id?: number | null; 
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

    const imgs: { id: number; dataUrl?: string; path?: string }[] = await r.json();
    if (!Array.isArray(imgs) || imgs.length === 0) return null;

    const first = imgs[0];
    const raw = first.dataUrl || first.path;
    if (!raw) return null;

    if (raw.startsWith('http') || raw.startsWith('data:')) {
      return raw;
    }
    
    return `${API_BASE}${raw}`;
  } catch (e) {
    console.error('Błąd pobierania pierwszego zdjęcia:', e);
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

    // 1 = sprzedaż, 2 = praca, 3 = pomoc
    const renderThumb = (item: Listing) => {
      const imgSrc = item.primary_image || null;
  
      // 1) jeśli mamy normalne zdjęcie
      if (imgSrc) {
        return (
          <div className="listing-thumb">
            <img src={imgSrc} alt={item.title} />
          </div>
        );
      }
  
      // 2) PRACA – teczka
      if (item.type_id === 2) {
        return (
          <div className="listing-thumb-space listing-thumb-space--icon">
            <img
              src="/icons/work-case-filled-svgrepo-com.svg"
              alt="Ogłoszenie pracy"
              className="listing-thumb-icon"
            />
          </div>
        );
      }
  
      // 3) POMOC – dłonie z sercem
      if (item.type_id === 3) {
        return (
          <div className="listing-thumb-space listing-thumb-space--icon">
            <img
              src="/icons/hands-holding-heart-svgrepo-com.svg"
              alt="Ogłoszenie pomocy"
              className="listing-thumb-icon"
            />
          </div>
        );
      }
  
      // 4) domyślny placeholder X
      return (
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
      );
    };
  

  useEffect(() => {
    if (!user) return;

    

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
              const isSold = l.status_id === 3; // 3 = sprzedane

              return (
                <div
                  key={l.id}
                  className={`listing-card ${
                    isSold ? 'listing-card--sold' : ''
                  }`}
                >
                  <div
                    className="listing-main"
                    onClick={() =>
                      navigate(`/listing/${l.id}`, {
                        state: { fromProfile: true },
                      })
                    }
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    {renderThumb(l)}

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
                    {isSold ? (
                      <button className="sold-button" disabled>
                        SPRZEDANO
                      </button>
                    ) : (
                      <>
                        <button
                          className={`feature-button ${
                            l.is_featured ? 'feature-button--active' : ''
                          }`}
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
                      </>
                    )}
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
              return (
                <div key={f.id} className="listing-card">
                  <div
                    className="listing-main"
                    onClick={() => navigate(`/listing/${f.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {renderThumb(f)}

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
