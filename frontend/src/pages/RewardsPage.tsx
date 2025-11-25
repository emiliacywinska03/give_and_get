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
                <p className="reward-brand"><strong>{r.brand}</strong></p>
                <p className="reward-desc">{r.description}</p>
                <p className="reward-percent">Zniżka: -{r.percent}%</p>
                <p className="reward-cost">Koszt: {r.points_cost} pkt</p>

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
                  Odbierz
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
