import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import './RewardsPage.css';


const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace(/\/$/, '');
const API_KEY = process.env.REACT_APP_API_KEY;

type Reward = {
  id: number;
  brand: string;
  description: string;
  percent: number;
  points_cost: number;
};

const BrandIcon: React.FC<{ brand: string }> = ({ brand }) => {
  const b = brand.toLowerCase();

  /* LIDL – kupon / karta */
  if (b === "lidl") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2"
          fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 10h10M7 14h6"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  /* EMPIK – książka */
  if (b === "empik") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        {/* lewa strona */}
        <path
          d="M4 6c0-1.1.9-2 2-2h6v14H6a2 2 0 0 0-2 2V6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* prawa strona */}
        <path
          d="M20 6c0-1.1-.9-2-2-2h-6v14h6a2 2 0 0 1 2 2V6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* środek */}
        <path
          d="M12 4v14"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.6"
        />
      </svg>
    );
  }


  /* MEDIA MARKT – monitor / elektronika */
  if (b === "mediamarkt") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <rect x="3" y="5" width="18" height="12" rx="2"
          fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 21h6M12 17v4"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  /* HEBE – kosmetyk */
  if (b === "hebe") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M9 3h6v4H9zM8 7h8v14H8z"
          fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  /* ROSSMANN – torba zakupowa (drogeria) */
  if (b === "rossmann") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M6.5 8h11l-1 13H7.5l-1-13z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 8a3 3 0 0 1 6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9 12h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
    );
  }

  /* SEPHORA – szminka */
  if (b === "sephora") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        {/* korpus */}
        <rect
          x="9"
          y="10"
          width="6"
          height="11"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        {/* część środkowa */}
        <path
          d="M9 14h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          opacity="0.75"
        />
        {/* szminka */}
        <path
          d="M10 10V6.8c0-.9.7-1.6 1.6-1.6h.8c.9 0 1.6.7 1.6 1.6V10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 6.8l2-1.8 2 1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }


  /* ZARA – koszulka (moda) */
  if (b === "zara") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M9 4l3 2 3-2 4 3-2 3v10H7V10L5 7l4-3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M10 6h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    );
  }


  /* ZALANDO – paczka */
  if (b === "zalando") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"
          fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  /* DOUGLAS – gwiazda premium */
  if (b === "douglas") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M12 3l2.7 5.6 6.2.9-4.5 4.4 1.1 6.2L12 18l-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9z"
          fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  /* FALLBACK */
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <circle cx="12" cy="12" r="9"
        fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
};



const RewardsPage: React.FC = () => {
  const { user, setUser } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false); 

  useEffect(() => {
    setCopied(false);
  }, [redeemMessage]);

  
  useEffect(() => {
    
    const fetchCatalog = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/rewards/catalog`, {
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        const data = await res.json();
        if (data.ok) setRewards(data.rewards);
      } catch (e) {
        console.error('Błąd pobierania katalogu nagród', e);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const redeemReward = async (id: number) => {
    if (!user) return;

    setRedeemMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/rewards/redeem/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      });
      const data = await res.json();
      if (!data.ok) {
        setRedeemMessage(data.message || 'Nie udało się odebrać nagrody');
        return;
      }

      // aktualizujemy punkty użytkownika w kontekście
      setUser((prev) => (prev ? { ...prev, points: data.userPoints } : prev));
      setRedeemMessage(`Kod dla ${data.brand}: ${data.code} (-${data.percent}%)`);
    } catch (e) {
      console.error('Błąd podczas odbierania nagrody', e);
      setRedeemMessage('Błąd serwera przy odbieraniu nagrody');
    }
  };

  const extractCodeFromMessage = (msg: string | null): string | null => {
    if (!msg) return null;
    const match = msg.match(/:\s*([A-Z0-9-]+)/i);
    return match ? match[1] : null;
  };

  const handleCopyCode = async () => {
    const code = extractCodeFromMessage(redeemMessage);
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (e) {
      console.error('Nie udało się skopiować kodu', e);
    }
  };

  if (!user) {
    return <p style={{ padding: '40px' }}>Musisz być zalogowany, aby korzystać z nagród.</p>;
  }

  const codeToCopy = extractCodeFromMessage(redeemMessage);

  return (
    <div className="rewards-page">
      <h1>Nagrody za punkty</h1>
      <p className="rewards-points-info">
        Masz aktualnie <strong>{user.points ?? 0}</strong> punktów.
      </p>

      {redeemMessage && (
        <div
          className={`rewards-message ${
            redeemMessage.includes('zbyt mało punktów') ? 'rewards-error' : 'rewards-success'
          }`}
        >
          <span className="rewards-message-text">{redeemMessage}</span>

          {codeToCopy && (
            <div className="rewards-message-actions">
              <button
                type="button"
                className="copy-code-btn"
                onClick={handleCopyCode}
                aria-label="Skopiuj kod"
              >
                {/* SVG ikony schowka */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="9"
                    y="3"
                    width="11"
                    height="14"
                    rx="2"
                    ry="2"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                  />
                  <rect
                    x="4"
                    y="7"
                    width="11"
                    height="14"
                    rx="2"
                    ry="2"
                    fill="white"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
              {copied && <span className="copy-hint">Skopiowano!</span>}
            </div>
          )}
        </div>
      )}


      {loading ? (
        <p>Ładowanie nagród...</p>
      ) : (
        <div className="rewards-grid">
          {rewards.map((r) => {
            const userPoints = user.points ?? 0;
            const canRedeem = userPoints >= r.points_cost;

            return (
              <div key={r.id} className="reward-card">
                <div className="reward-top">
                  <div className="reward-brandchip">
                    <span className="reward-brandicon">
                      <BrandIcon brand={r.brand} />
                    </span>

                    <p className="reward-brand">
                      <strong>{r.brand}</strong>
                    </p>
                  </div>

                  <span className="reward-badge">-{r.percent}%</span>
                </div>

                <p className="reward-desc">Kupon zniżkowy {r.percent}%</p>


                <button
                  className={`reward-button ${!canRedeem ? 'reward-button--locked' : ''}`}
                  onClick={() => {
                    setRedeemMessage(null);

                    if (!canRedeem) {
                      setRedeemMessage('Masz zbyt mało punktów, aby odebrać tę nagrodę.');
                      return;
                    }

                    redeemReward(r.id);
                  }}
                >
                  Odbierz za {r.points_cost} pkt
                </button>
              </div>

            );
          })}

        </div>
      )}
    </div>
  );
};

export default RewardsPage;
