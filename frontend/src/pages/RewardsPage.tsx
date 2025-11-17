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

  if (!user) {
    return <p style={{ padding: '40px' }}>Musisz być zalogowany, aby korzystać z nagród.</p>;
  }

  return (
    <div className="rewards-page">
      <h1>Nagrody za punkty</h1>
      <p className="rewards-points-info">
        Masz aktualnie <strong>{user.points ?? 0}</strong> punktów.
      </p>

      {redeemMessage && (
        <div className="rewards-message">
          {redeemMessage}
        </div>
      )}

      {loading ? (
        <p>Ładowanie nagród...</p>
      ) : (
        <div className="rewards-grid">
          {rewards.map((r) => (
            <div key={r.id} className="reward-card">
              <p className="reward-brand"><strong>{r.brand}</strong></p>
              <p className="reward-desc">{r.description}</p>
              <p className="reward-percent">Zniżka: -{r.percent}%</p>
              <p className="reward-cost">Koszt: {r.points_cost} pkt</p>
              <button
                className="reward-button"
                disabled={(user.points ?? 0) < r.points_cost}
                onClick={() => redeemReward(r.id)}
              >
                Odbierz
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RewardsPage;
