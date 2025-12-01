import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './MessagesConversationPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type ChatMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  listing_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_username: string;
  receiver_username: string;
};

const MessagesConversationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // listingId
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const listingId = Number(id);

  const peerId = useMemo(() => {
    const v = searchParams.get('peer');
    if (!v) return null;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const peerName = useMemo(() => {
    if (!user) return '';
    const last = messages[messages.length - 1];
    if (!last) return '';
    if (last.sender_id === user.id) {
      return last.receiver_username;
    }
    return last.sender_username;
  }, [messages, user]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!listingId) {
      setError('Nieprawidłowe ID ogłoszenia.');
      setLoading(false);
      return;
    }

    const fetchConversation = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/api/messages/listing/${listingId}`, {
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
        console.error('Błąd pobierania konwersacji:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania konwersacji.');
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [user, listingId, navigate]);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!listingId) return;
    if (!content.trim()) return;

    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: JSON.stringify({
          listingId,
          content: content.trim(),
          receiverId: peerId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        const msg = data?.error || 'Nie udało się wysłać wiadomości.';
        throw new Error(msg);
      }

      const newMsg: ChatMessage = {
        ...data.message,
        sender_username: user.username,
        receiver_username: peerName || 'Użytkownik',
      };

      setMessages((prev) => [...prev, newMsg]);
      setContent('');
    } catch (err) {
      console.error('Błąd podczas wysyłania wiadomości:', err);
    } finally {
      setSending(false);
    }
  };

  if (!listingId) {
    return <p className="messages-conv-error">Nieprawidłowe ID ogłoszenia.</p>;
  }

  return (
    <div className="messages-conv-page">
      <div className="messages-conv-header">
        <button
          type="button"
          className="messages-conv-back"
          onClick={() => navigate('/messages')}
        >
          ← Wróć do listy wiadomości
        </button>

        <h2>Czat dotyczący ogłoszenia</h2>
        <p className="messages-conv-subtitle">
          Ogłoszenie:{' '}
          <Link to={`/listing/${listingId}`} className="messages-conv-listing-link">
            Zobacz szczegóły ogłoszenia
          </Link>
        </p>
        {peerName && (
          <p className="messages-conv-peer">Rozmowa z: {peerName}</p>
        )}
      </div>

      {loading ? (
        <p className="messages-conv-info">Ładowanie konwersacji...</p>
      ) : error ? (
        <p className="messages-conv-error">{error}</p>
      ) : (
        <>
          <div className="messages-conv-thread">
            {messages.length === 0 ? (
              <p className="messages-conv-info">
                Brak wiadomości w tej konwersacji – rozpocznij rozmowę poniżej.
              </p>
            ) : (
              messages.map((m) => {
                const mine = user && m.sender_id === user.id;
                return (
                  <div
                    key={m.id}
                    className={`messages-conv-bubble ${mine ? 'mine' : 'theirs'}`}
                  >
                    <div className="messages-conv-bubble-header">
                      <span className="messages-conv-author">
                        {mine ? 'Ty' : m.sender_username}
                      </span>
                      <span className="messages-conv-date">
                        {formatDate(m.created_at)}
                      </span>
                    </div>
                    <div className="messages-conv-text">{m.content}</div>
                  </div>
                );
              })
            )}
          </div>

          <form className="messages-conv-form" onSubmit={handleSend}>
            <textarea
              className="messages-conv-textarea"
              placeholder="Napisz odpowiedź..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              disabled={sending}
            />
            <button
              type="submit"
              className="messages-conv-submit"
              disabled={sending || !content.trim()}
            >
              {sending ? 'Wysyłanie...' : 'Wyślij'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default MessagesConversationPage;