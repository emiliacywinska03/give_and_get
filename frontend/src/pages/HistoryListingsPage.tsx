import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import './HistoryListingsPage.css'

interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  created_at: string;
  primary_image?: string | null;
  is_featured?: boolean;
  status_id?: number | null;
  type_id?: number | null;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

const SOLD_STATUS_ID = 3;
const HISTORY_STATUS_ID = 4;
const RESUME_COST_POINTS = 5;

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

    if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
    return `${API_BASE}${raw}`;
  } catch (e) {
    console.error('Błąd pobierania pierwszego zdjęcia:', e);
    return null;
  }
}

const HistoryListingsPage: React.FC = () => {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();

  const [historyListings, setHistoryListings] = useState<Listing[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [soldListings, setSoldListings] = useState<Listing[]>([]);
  const [endedListings, setEndedListings] = useState<Listing[]>([]);


  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      setLoadingHistory(true);
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

        const sold = data.filter((x: any) => x.status_id === SOLD_STATUS_ID);
        const ended = data.filter((x: any) => x.status_id === HISTORY_STATUS_ID);

        const mapWithImages = async (arr: any[]) =>
          Promise.all(
            arr.map(async (item: any) => {
              const primary =
                (item.primary_image as string | null) ??
                (await fetchFirstImageFor(item.id));
              return { ...item, primary_image: primary ?? null };
            })
          );

        const soldWithImages: Listing[] = await mapWithImages(sold);
        const endedWithImages: Listing[] = await mapWithImages(ended);

        setSoldListings(soldWithImages);
        setEndedListings(endedWithImages);

      } catch (e) {
        console.error('Błąd pobierania historii:', e);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [user]);

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

      // punkty
      if (typeof data?.points === 'number') {
        setUser((prev: any) => (prev ? { ...prev, points: data.points } : prev));
      } else {
        setUser((prev: any) =>
          prev ? { ...prev, points: (prev.points ?? 0) - RESUME_COST_POINTS } : prev
        );
      }

      // usuń z historii na tej stronie (bo wraca do aktywnych)
      setEndedListings((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert('Wystąpił błąd podczas wznawiania ogłoszenia.');
    }
  };

  const renderThumb = (item: Listing) => {
    const imgSrc = item.primary_image || null;
  
    // 1) jest zdjęcie -> normalnie
    if (imgSrc) {
      return (
        <div className="listing-thumb">
          <img src={imgSrc} alt={item.title} />
        </div>
      );
    }
  
    // 2) PRACA (type_id === 2) -> teczka
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
  
    // 3) POMOC (type_id === 3) -> dłonie z sercem
    if (item.type_id === 3) {
      return (
        <div className="listing-thumb
        -space listing-thumb-space--icon">
          <img
            src="/icons/work-case-filled-svgrepo-com.svg"
            alt="Ogłoszenie pracy"
            className="listing-thumb-icon"
          />
        </div>
      );
    }
  
    // 4) SPRZEDAŻ (type_id === 1) -> koszyk (jeśli chcesz)
    if (item.type_id === 1) {
      return (
        <div className="listing-thumb-space listing-thumb-space--icon">
          <img
            src="/icons/iconmonstr-shopping-cart-24.svg"
            alt="Ogłoszenie sprzedaży"
            className="listing-thumb-icon"
          />
        </div>
      );
    }
  
    // 5) fallback (X)
    return (
      <div className="listing-thumb-space">
        <svg
          className="listing-thumb-placeholder-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  };
  

  if (loading) return <p>Ładowanie danych użytkownika...</p>;
  if (!user) return <p>Nie jesteś zalogowany.</p>;

  return (
    <div className="profile-page history-layout">
      <div className="history-main">
        <div className="profile-card">

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 className="profile-title" style={{ margin: 0 }}>Historia ogłoszeń</h2>
        </div>

        {/* PANEL PUNKTÓW */}
        <div className="history-points-panel">
          <div style={{ fontSize: 14, color: "#6b7280" }}>Twoje punkty</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#2f6fff", lineHeight: 1.1 }}>
            {(user as any)?.points ?? 0}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
            Wznowienie ogłoszenia: <b>{RESUME_COST_POINTS} pkt</b>
          </div>
        </div>

  
        {loadingHistory ? (
          <p>Ładowanie historii…</p>
        ) : (
          <>

            {/* ---------------- Zakończone / Nieaktywne ---------------- */}
            <h3 className="profile-subtitle">Zakończone ogłoszenia</h3>
  
            {endedListings.length === 0 ? (
              <p>Nie masz zakończonych ogłoszeń.</p>
            ) : (
              <div className="listing-grid">
                {endedListings.map((l) => (
                  <div key={l.id} className="listing-card listing-card--history">
                    <div
                      className="listing-main"
                      onClick={() => navigate(`/listing/${l.id}`)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <span className="sold-badge-corner">NIEAKTYWNE</span>
  
                      {renderThumb(l)}
  
                      <div className="listing-content">
                        <h4 className="listing-title">{l.title}</h4>
                        <p className="listing-desc">{l.description}</p>
                        <small className="listing-date">
                          Dodano: {new Date(l.created_at).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
  
                    <div className="listing-actions">
                      <button className="resume-button" onClick={() => handleResume(l.id)}>
                        Wznów
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}


            {/* ---------------- Sprzedane ---------------- */}
            <h3 className="profile-subtitle">Sprzedane ogłoszenia</h3>
  
            {soldListings.length === 0 ? (
              <p>Nie masz sprzedanych ogłoszeń.</p>
            ) : (
              <div className="listing-grid">
                {soldListings.map((l) => (
                  <div key={l.id} className="listing-card listing-card--sold">
                    <div
                      className="listing-main"
                      onClick={() => navigate(`/listing/${l.id}`)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <span className="sold-badge-corner">SPRZEDANO</span>
  
                      {renderThumb(l)}
  
                      <div className="listing-content">
                        <h4 className="listing-title">{l.title}</h4>
                        <p className="listing-desc">{l.description}</p>
                        <small className="listing-date">
                          Dodano: {new Date(l.created_at).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
  
          </>
        )}
      </div>
      </div>
    </div>
  );
  
};

export default HistoryListingsPage;
