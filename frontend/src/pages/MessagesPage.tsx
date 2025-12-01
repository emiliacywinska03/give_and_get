import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './MessagesPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type MessageItem = {
  id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  listing_id: number;
  listing_title: string;
  sender_id: number;
  sender_username: string;
  receiver_id: number;
  receiver_username: string;
};

type ConversationItem = {
  last: MessageItem;
  peerId: number;
  peerName: string;
  incoming: boolean; // czy ostatnia wiadomość jest odebrana (true) czy wysłana (false)
};

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/api/messages/inbox`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          const msg = data?.error || 'Nie udało się pobrać wiadomości.';
          throw new Error(msg);
        }

        setMessages(data.messages || []);
      } catch (err: any) {
        console.error('Błąd pobierania wiadomości:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania wiadomości.');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [user, navigate]);

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  };

  const conversations: ConversationItem[] = useMemo(() => {
    if (!user) return [];

    const map = new Map<string, ConversationItem>();

    for (const m of messages) {
      const incoming = m.receiver_id === user.id;
      const peerId = incoming ? m.sender_id : m.receiver_id;
      const peerName = incoming ? m.sender_username : m.receiver_username;
      const key = `${m.listing_id}-${peerId}`;

      const existing = map.get(key);
      if (!existing) {
        // pierwsza wiadomość w tej parze => ustaw
        map.set(key, { last: m, peerId, peerName, incoming });
      } else {
        // wybierz nowszą jako „ostatnią”
        const prevTime = new Date(existing.last.created_at).getTime();
        const curTime = new Date(m.created_at).getTime();
        if (curTime > prevTime) {
          map.set(key, { last: m, peerId, peerName, incoming });
        }
      }
    }

    return Array.from(map.values());
  }, [messages, user]);

  return (
    <div className="messages-page">
      <div className="messages-header">
        <h2>Wiadomości</h2>
        <p className="messages-subtitle">
          Tu zobaczysz wszystkie wiadomości wysłane i otrzymane,
          wraz z ogłoszeniem, którego dotyczą.
        </p>
      </div>

      {loading ? (
        <p className="messages-info">Ładowanie wiadomości...</p>
      ) : error ? (
        <p className="messages-error">{error}</p>
      ) : conversations.length === 0 ? (
        <p className="messages-info">Nie masz jeszcze żadnych wiadomości.</p>
      ) : (
        <div className="messages-list">
          {conversations.map((c) => {
            const { last, peerId, peerName, incoming } = c;

            return (
              <div
                key={`${last.listing_id}-${peerId}`}
                className={`messages-item ${incoming ? 'incoming' : 'outgoing'}`}
                onClick={() =>
                  navigate(`/messages/listing/${last.listing_id}?peer=${peerId}`)
                }
                style={{ cursor: 'pointer' }}
              >
                <div className="messages-item-top">
                  <span className="messages-direction">
                    {incoming ? 'Odebrana' : 'Wysłana'}
                  </span>
                  <span className="messages-date">
                    {formatDate(last.created_at)}
                  </span>
                </div>

                <div className="messages-item-middle">
                  <div className="messages-peer">
                    <span className="messages-peer-label">
                      {incoming ? 'Od:' : 'Do:'}
                    </span>
                    <span className="messages-peer-name">{peerName}</span>
                  </div>

                  <div className="messages-listing">
                    <span className="messages-listing-label">Ogłoszenie:</span>
                    <span className="messages-listing-link">
                      {last.listing_title}
                    </span>
                  </div>
                </div>

                <p className="messages-content">{last.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;