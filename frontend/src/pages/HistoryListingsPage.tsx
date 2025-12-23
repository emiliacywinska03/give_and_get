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
  purchase_id?: number;
  purchased_price?: number;
  purchased_at?: string;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

const normalizeImgUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('http')) return raw;
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  return raw;
};

const firstImageCache = new Map<number, string | null>();

const SOLD_STATUS_ID = 3;
const HISTORY_STATUS_ID = 4;
const RESUME_COST_POINTS = 5;

async function fetchFirstImageFor(listingId: number): Promise<string | null> {
  if (firstImageCache.has(listingId)) {
    return firstImageCache.get(listingId) ?? null;
  }

  try {
    const r = await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
      credentials: 'include',
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    });
    if (!r.ok) {
      firstImageCache.set(listingId, null);
      return null;
    }

    const imgs: { id: number; path?: string }[] = await r.json();
    if (!Array.isArray(imgs) || imgs.length === 0) {
      firstImageCache.set(listingId, null);
      return null;
    }

    const raw = imgs[0]?.path ?? null;
    const normalized = normalizeImgUrl(raw);
    firstImageCache.set(listingId, normalized);
    return normalized;
  } catch (e) {
    console.error('Błąd pobierania pierwszego zdjęcia:', e);
    firstImageCache.set(listingId, null);
    return null;
  }
}

const PackageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <path d="M3.27 6.96L12 12.01l8.73-5.05"/>
    <path d="M12 22.08V12"/>
  </svg>
);

const TruckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="3" width="15" height="13"/>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const SHIPPING_LS_KEY = 'gg_shipping_status_v1';
type ShipState = 'none' | 'sent';

const loadShippingFromLS = (): Record<string, ShipState> => {
  try {
    const raw = localStorage.getItem(SHIPPING_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const out: Record<string, ShipState> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === 'none' || v === 'sent') out[String(k)] = v;
    }
    return out;
  } catch {
    return {};
  }
};

const saveShippingToLS = (data: Record<string, ShipState>) => {
  try {
    localStorage.setItem(SHIPPING_LS_KEY, JSON.stringify(data));
  } catch {}
};




const HistoryListingsPage: React.FC = () => {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();

  const [historyListings, setHistoryListings] = useState<Listing[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [soldListings, setSoldListings] = useState<Listing[]>([]);
  const [endedListings, setEndedListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<Listing[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [shippingStatus, setShippingStatus] = useState<Record<string, ShipState>>(() => loadShippingFromLS());
  const getShippingStatus = (id: number) => shippingStatus[String(id)] ?? 'none';

  useEffect(() => {
    saveShippingToLS(shippingStatus);
  }, [shippingStatus]);
  
  type TabKey = 'ended' | 'sold' | 'bought';
  const [activeTab, setActiveTab] = useState<TabKey>('ended');


  const fetchPurchases = async () => {
    setLoadingPurchases(true);
    try {
      const res = await fetch(`${API_BASE}/api/price-offers/my-purchases`, {
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
  
      const data = await res.json();
  
      if (!res.ok || !Array.isArray(data)) {
        console.error('Niepoprawna odpowiedź API (my purchases):', data);
        return;
      }
  
      const withImages: Listing[] = await Promise.all(
        data.map(async (item: any) => {
          const primary =
            normalizeImgUrl(item.primary_image as string | null) ??
            (await fetchFirstImageFor(item.id));
  
          return { ...item, primary_image: primary ?? null };
        })
      );
  
      setPurchases(withImages);
    } catch (err) {
      console.error('Błąd pobierania historii zakupów:', err);
    } finally {
      setLoadingPurchases(false);
    }
  };
  

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
                normalizeImgUrl(item.primary_image as string | null) ??
                (await fetchFirstImageFor(item.id));
              return { ...item, primary_image: primary ?? null };
            })
          );

        const soldWithImages: Listing[] = await mapWithImages(sold);
        const endedWithImages: Listing[] = await mapWithImages(ended);

        setSoldListings(soldWithImages);

        try {
          const pairs = await Promise.all(
            soldWithImages.map(async (l) => {
              const st = await fetchShippingStatus(l.id);
              return [String(l.id), st] as const;
            })
          );

          setShippingStatus(prev => {
            const next = { ...prev };
            for (const [id, st] of pairs) next[id] = st;
            return next;
          });
        } catch (e) {
          console.error('Błąd pobierania statusów wysyłki:', e);
        }


        setEndedListings(endedWithImages);

      } catch (e) {
        console.error('Błąd pobierania historii:', e);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
    fetchPurchases();
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


  const updateShipping = async (listingId: number, status: 'packed' | 'sent') => {
    const res = await fetch(`${API_BASE}/api/shipping/${listingId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: JSON.stringify({ status }),
    });
  
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Nie udało się ustawić statusu wysyłki.');
    }
    return data;
  };

  const fetchShippingStatus = async (listingId: number): Promise<ShipState> => {
    const res = await fetch(`${API_BASE}/api/shipping/${listingId}`, {
      method: 'GET',
      credentials: 'include',
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    });
  
    const data = await res.json().catch(() => null);
  
    if (!res.ok || !data?.ok) return 'none';
  
    const s = data.status;
    if (s === 'sent') return 'sent';
    return 'none';
  };
  

  
  const renderThumb = (item: Listing) => {
    const imgSrc = normalizeImgUrl(item.primary_image || null);
  
    if (imgSrc) {
      return (
        <div className="listing-thumb">
          <img src={imgSrc} alt={item.title} loading="lazy" decoding="async" />
        </div>
      );
    }
  
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

        <div className="history-points-panel">
          <div style={{ fontSize: 14, color: "#6b7280" }}>Twoje punkty</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#2f6fff", lineHeight: 1.1 }}>
            {(user as any)?.points ?? 0}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
            Wznowienie ogłoszenia: <b>{RESUME_COST_POINTS} pkt</b>
          </div>
        </div>

        <div className="history-tabs">
          <button
            className={`history-tab ${activeTab === 'ended' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ended')}
          >
            Zakończone
          </button>

          <button
            className={`history-tab ${activeTab === 'sold' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('sold')}
          >
            Sprzedane
          </button>

          <button
            className={`history-tab ${activeTab === 'bought' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('bought')}
          >
            Kupione
          </button>
        </div>

  
        {loadingHistory ? (
          <p>Ładowanie historii…</p>
        ) : (
          <>
            {/* ===== ZAKOŃCZONE ===== */}
            {activeTab === 'ended' && (
              <>
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
              </>
            )}

            {/* ===== SPRZEDANE ===== */}
            {activeTab === 'sold' && (
              <>
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

                        {getShippingStatus(l.id) !== 'sent' && (
                          <span className="ship-alert-corner">
                            Wyślij paczkę!
                          </span>
                        )}

                        {renderThumb(l)}
                    
                        <div className="listing-content">
                          <h4 className="listing-title">{l.title}</h4>
                          <p className="listing-desc">{l.description}</p>
                          <small className="listing-date">
                            Dodano: {new Date(l.created_at).toLocaleDateString()}
                          </small>
                        </div>
                      </div>
                    
                      {/* PRAWA KOLUMNA */}
                      <div className="listing-actions listing-actions--right">
                        <div className="shipping-actions shipping-actions--right">
                    
                          <button
                            className={`ship-btn ${getShippingStatus(l.id) === 'sent' ? 'ship-btn--done' : 'ship-btn--primary'}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = window.confirm('Czy chcesz oznaczyć jako wysłane?');
                              if (!ok) return;
                            
                              try {
                                await updateShipping(l.id, 'sent');
                                setShippingStatus(prev => ({ ...prev, [String(l.id)]: 'sent' }));
                                setSoldListings(prev => prev.filter(x => x.id !== l.id));
                                setEndedListings(prev => [{ ...l }, ...prev]);
                                setActiveTab('ended');
                              } catch (err: any) {
                                alert(err?.message || 'Błąd');
                              }
                            }}
                            
                            
                            disabled={getShippingStatus(l.id) === 'sent'}
                            title={getShippingStatus(l.id) === 'sent' ? 'Już oznaczone jako wysłane' : ''}

                          >
                            <TruckIcon />
                            <span>Oznacz jako wysłane</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'bought' && (
            <>
              <h3 className="profile-subtitle">Kupione</h3>

              {loadingPurchases ? (
                <p>Ładowanie zakupów…</p>
              ) : purchases.length === 0 ? (
                <p>Nie masz jeszcze żadnych zakupów.</p>
              ) : (
                <div className="listing-grid">
                  {purchases.map((p) => (
                    <div key={p.purchase_id ?? p.id} className="listing-card listing-card--bought">
                      <div
                        className="listing-main"
                        onClick={() => navigate(`/listing/${p.id}`)}
                        style={{ cursor: 'pointer', position: 'relative' }}
                      >
                        <span className="sold-badge-corner">KUPIONO</span>

                        {renderThumb(p)}

                        <div className="listing-content">
                          <h4 className="listing-title">{p.title}</h4>
                          <p className="listing-desc">{p.description}</p>

                          {typeof p.purchased_price === 'number' && (
                            <p><strong>Kupiono za:</strong> {p.purchased_price} zł</p>
                          )}

                          {p.purchased_at && (
                            <small className="listing-date">
                              Kupiono: {new Date(p.purchased_at).toLocaleDateString()}
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          </>
        )}
      </div>
      </div>
    </div>
  );
  
};

export default HistoryListingsPage;
