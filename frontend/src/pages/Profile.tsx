import React, { useEffect, useState, useRef } from 'react';
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarBuster, setAvatarBuster] = useState<number>(Date.now());
  const navigate = useNavigate();
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  const avatarUrl = (user as any)?.avatar_url as string | undefined;
  const historyRef = useRef<HTMLHeadingElement | null>(null);


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
            src="/icons/hands-holding-heart-svgrepo-com.svg"
            alt="Ogłoszenie pomocy"
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
            src="/icons/work-case-filled-svgrepo-com.svg"
            alt="Ogłoszenie pracy"
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

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Możesz wgrać tylko pliki graficzne.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Maksymalny rozmiar zdjęcia to 5 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingAvatar(true);

    try {
      const res = await fetch(`${API_BASE}/api/users/avatar`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Błąd przy zapisie avatara:', data);
        alert(data.error || data.message || 'Nie udało się zaktualizować zdjęcia profilowego.');
        return;
      }

      const newAvatarUrl: string | undefined =
        data.avatarUrl || data.avatar_url;

     if (newAvatarUrl) {
        const buster = Date.now();
        setAvatarBuster(buster);

        const withBuster = newAvatarUrl.includes('?')
          ? `${newAvatarUrl}&v=${buster}`
          : `${newAvatarUrl}?v=${buster}`;

        setAvatarPreview(withBuster);

        await refreshMe();
      }
    } catch (err) {
      console.error('Błąd podczas zmiany avatara:', err);
      alert('Wystąpił błąd podczas zmiany zdjęcia profilowego.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (!user) return; refreshMe();
  

    // ---------- Twoje ogłoszenia ----------
    const fetchMyListings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/my`, {
          credentials: 'include',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });

        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
          console.error('Niepoprawna odpowiedź API (my listings):', data);
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

        setListings(withImages);
      } catch (err) {
        console.error('Błąd pobierania moich ogłoszeń:', err);
      } finally {
        setLoadingListings(false);
      }
    };

    const handleToggleFavorite = async (
      e: React.MouseEvent,
      listingId: number,
      isCurrentlyFavorite: boolean
    ) => {
      e.preventDefault();
      e.stopPropagation();
    
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
    
        // aktualizacja serduszek
        setFavoriteIds((prev) =>
          isCurrentlyFavorite ? prev.filter((id) => id !== listingId) : [...prev, listingId]
        );
    
        // jak odklikniesz — usuń z listy "Moje ulubione" w profilu
        if (isCurrentlyFavorite) {
          setFavorites((prev) => prev.filter((l) => l.id !== listingId));
        }
      } catch (err) {
        console.error('Błąd podczas zmiany ulubionych:', err);
      }
    };
    

    // ---------- Ulubione ---------- //
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
        setFavoriteIds(withImages.map((x) => x.id));
      } catch (err) {
        console.error('Błąd pobierania ulubionych ogłoszeń:', err);
      } finally {
        setLoadingFavorites(false);
      }
    };

    fetchMyListings();
    fetchFavorites();
  }, [user]);


  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(
      'Czy na pewno chcesz usunąć ogłoszenie?'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}/history`, {
        method: 'PATCH',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        credentials: 'include',
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(`Błąd: ${data?.error || 'Nie udało się przenieść do historii'}`);
        return;
      }

      // 🔹 NIE usuwamy z listy — tylko zmieniamy status
      setListings((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status_id: HISTORY_STATUS_ID }
            : item
        )
      );
    } catch (err) {
      console.error('Błąd podczas przenoszenia do historii:', err);
      alert('Wystąpił błąd podczas przenoszenia do historii.');
    }
  };


  const handleResume = async (id: number) => {
    const userPoints = Number((user as any)?.points ?? 0);
  
    if (userPoints < RESUME_COST_POINTS) {
      alert('Masz za mało punktów, aby wznowić ogłoszenie.');
      return;
    }
  
    const ok = window.confirm(`Wznowić ogłoszenie za ${RESUME_COST_POINTS} pkt?`);
    if (!ok) return;
  
    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}/resume`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
  
      const data = await res.json().catch(() => null);
  
      if (!res.ok) {
        alert(data?.error || 'Nie udało się wznowić ogłoszenia.');
        return;
      }
  
      // aktualizacja punktów użytkownika
      if (typeof data?.points === 'number') {
        setUser((prev: any) => (prev ? { ...prev, points: data.points } : prev));
      } else {
        setUser((prev: any) =>
          prev ? { ...prev, points: (prev.points ?? 0) - RESUME_COST_POINTS } : prev
        );
      }
  
      // ogłoszenie wraca do aktywnych
      setListings((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status_id: null } : item
        )
      );
    } catch (e) {
      console.error(e);
      alert('Wystąpił błąd podczas wznawiania ogłoszenia.');
    }
  };
  

  const handleToggleFavorite = async (
    e: React.MouseEvent,
    listingId: number,
    isCurrentlyFavorite: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
  
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
  

  if (loading) return <p>Ładowanie danych użytkownika...</p>;
  if (!user) return <p>Nie jesteś zalogowany.</p>;
  const FEATURE_COST_POINTS = 5;
  const RESUME_COST_POINTS = 5;


  const handleToggleFeatured = async (id: number) => {
    const listing = listings.find((x) => x.id === id);
    if (!listing) return;
  
    const currentlyFeatured = Boolean(listing.is_featured);
  
    // usuwanie wyróżnienia — bez punktów i bez confirmu
    if (currentlyFeatured) {
      try {
        const res = await fetch(`${API_BASE}/api/listings/${id}/featured`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
  
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          alert(err?.error || 'Nie udało się usunąć wyróżnienia.');
          return;
        }
  
        const data = await res.json();
        setListings((prev) =>
          prev.map((l) => (l.id === id ? { ...l, is_featured: data.is_featured } : l))
        );
        return;
      } catch (e) {
        console.error(e);
        alert('Wystąpił błąd podczas usuwania wyróżnienia.');
        return;
      }
    }
  
    // dodawanie wyróżnienia — płatne punktami
    const userPoints = Number((user as any)?.points ?? 0);
  
    if (userPoints < FEATURE_COST_POINTS) {
      alert('Masz za mało punktów, aby wyróżnić ogłoszenie.');
      return;
    }
  
    const ok = window.confirm(`Czy chcesz wyróżnić ogłoszenie za ${FEATURE_COST_POINTS} pkt?`);
    if (!ok) return;
  
    try {
      // 1) ustaw wyróżnienie 
      const res = await fetch(`${API_BASE}/api/listings/${id}/featured`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
  
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Nie udało się wyróżnić ogłoszenia.');
        return;
      }
  
      const data = await res.json();
  
      // 2) odejmij punkty lokalnie 
      setUser((prev: any) => (prev ? { ...prev, points: (prev.points ?? 0) - FEATURE_COST_POINTS } : prev));
  
      // 3) zaktualizuj ogłoszenie w liście
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, is_featured: data.is_featured } : l))
      );
  
    } catch (e) {
      console.error(e);
      alert('Wystąpił błąd podczas wyróżniania ogłoszenia.');
    }
  };
  

  const SOLD_STATUS_ID = 3;
  const HISTORY_STATUS_ID = 4;


  const refreshMe = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
      if (!res.ok) return;
      const me = await res.json();
      setUser(me);
      setAvatarBuster(Date.now());
    } catch (e) {
      console.error('Nie udało się odświeżyć danych użytkownika', e);
    }
  };

  const activeListings = listings.filter(
    (l) => l.status_id !== SOLD_STATUS_ID && l.status_id !== HISTORY_STATUS_ID
  );
  
  
  const historyListings = listings.filter(
    (l) => l.status_id === HISTORY_STATUS_ID
  );
  

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2 className="profile-title">Profil użytkownika</h2>

        <div className="profile-top">
          {/* LEWA STRONA — avatar + dane */}
          <div className="profile-left">
          <div className="profile-avatar-block">
              <div className="profile-avatar">
                {avatarPreview || avatarUrl ? (
                 <img
                    src={
                      avatarPreview
                        ? avatarPreview
                        : avatarUrl
                        ? (avatarUrl.includes('?')
                            ? `${avatarUrl}&v=${avatarBuster}`
                            : `${avatarUrl}?v=${avatarBuster}`)
                        : ''
                    }
                    alt="Zdjęcie profilowe użytkownika"
                    className="profile-avatar-img"
                  />
                ) : (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-7 8a7 7 0 1 1 14 0H5Z"
                    />
                  </svg>
                )}
              </div>


              <label className="profile-avatar-upload">
                <span>{uploadingAvatar ? 'Zapisywanie...' : 'Zmień zdjęcie'}</span>
                <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
              </label>

              <button
                type="button"
                className="profile-avatar-upload profile-avatar-upload--logout"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Wyloguj
              </button>
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
                <strong>{activeListings.length}</strong>
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
              className="profile-history-button"
              onClick={() => navigate('/history')}
            >
              Historia ogłoszeń
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
        <h3 className="profile-subtitle">Moje ogłoszenia</h3>

        {loadingListings ? (
          <p>Ładowanie ogłoszeń...</p>
        ) : activeListings.length === 0 ? (
          <p>Nie masz jeszcze żadnych ogłoszeń.</p>
        ) : (
          <div className="listing-grid">
            {activeListings.map((l) => {
              return (
                <div key={l.id} className="listing-card">
                  <div
                    className="listing-main"
                    onClick={() =>
                      navigate(`/listing/${l.id}`, { state: { fromProfile: true } })
                    }
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    <div className="thumb-wrap">
                    {l.is_featured && (
                      <button
                        type="button"
                        className="featured-star-badge"
                        title="Usuń wyróżnienie"
                        onClick={(e) => {
                          e.stopPropagation();   
                          handleToggleFeatured(l.id);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.173L12 18.896l-7.336 3.874 1.402-8.173L.132 9.21l8.2-1.192z"
                          />
                        </svg>
                      </button>
                    )}


                      {renderThumb(l)}
                    </div>


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

                    <button className="delete-button" onClick={() => handleDelete(l.id)}>
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
            const isFav = favoriteIds.includes(f.id);

            return (
              <div key={f.id} className="listing-card">
                <div
                  className="listing-main"
                  onClick={() => navigate(`/listing/${f.id}`)}
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  {/* SERDUSZKO - TAKIE SAMO JAK W Favorites */}
                  <button
                    type="button"
                    className={`favorite-toggle ${isFav ? 'favorite-toggle--active' : ''}`}
                    aria-label={isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                    onClick={(e) => handleToggleFavorite(e, f.id, isFav)}
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