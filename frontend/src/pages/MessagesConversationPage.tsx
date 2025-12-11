import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { io } from 'socket.io-client';
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

type ListingPreview = {
  id: number;
  title?: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  typeId?: number | null;
  authorUsername?: string;
  authorAvatarUrl?: string | null;
};

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]);
  return letters.join('').toUpperCase();
};


const getTypeIconSrc = (typeId?: number | null): string | null => {
  if (typeId === 3) {
    return '/icons/work-case-filled-svgrepo-com.svg';
  }
  if (typeId === 2) {
    return '/icons/hands-holding-heart-svgrepo-com.svg';
  }
  return null;
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
  const [listingInfo, setListingInfo] = useState<ListingPreview | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const remoteTypingTimeoutRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!listingId) return;

    const fetchListing = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/${listingId}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
        });

        const data = await res.json();
        if (!res.ok) {
          return;
        }


        const l = data.listing ?? data.data ?? data;

        if (!l) {
          return;
        }


        const toSrc = (val: any): string | null => {
          if (!val) return null;
          if (typeof val === 'string') {
            if (val.startsWith('data:') || val.startsWith('http')) return val;
            return `${API_BASE}${val}`;
          }
          if (typeof val === 'object') {
            if (val.dataUrl) return toSrc(val.dataUrl);
            if (val.url) return toSrc(val.url);
            if (val.path) return toSrc(val.path);
          }
          return null;
        };

        let resolvedThumb: string | null = null;

        try {
          const ri = await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
            headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
            credentials: 'include',
          });
          if (ri.ok) {
            const imgs = await ri.json();
            if (Array.isArray(imgs) && imgs.length > 0) {
              const first = imgs[0];
              const src = toSrc(
                (first && (first.dataUrl || first.url || first.path)) || first,
              );
              if (src) {
                resolvedThumb = src;
              }
            }
          }
        } catch (e) {
          console.error('Błąd pobierania zdjęć ogłoszenia (preview):', e);
        }
        if (!resolvedThumb && Array.isArray(l.images) && l.images.length > 0) {
          const src = toSrc(l.images[0]);
          if (src) {
            resolvedThumb = src;
          }
        }
        if (!resolvedThumb) {
          const rawThumb =
            l.thumbnailUrl ||
            l.thumbnail_url ||
            l.mainPhotoUrl ||
            l.main_photo_url ||
            l.photoUrl ||
            l.photo_url ||
            null;
          const src = toSrc(rawThumb);
          if (src) {
            resolvedThumb = src;
          }
        }

        const preview: ListingPreview = {
          id: l.id,
          title: l.title || l.name || '',
          thumbnailUrl: resolvedThumb,
          imageUrl: resolvedThumb,
          typeId:
            typeof l.type_id === 'number'
              ? l.type_id
              : typeof l.typeId === 'number'
              ? l.typeId
              : null,
          authorUsername: l.author_username || l.authorUsername || '',
          authorAvatarUrl: l.author_avatar_url || l.authorAvatarUrl || null,
        };

        setListingInfo(preview);
      } catch (e) {
        console.error('Błąd pobierania ogłoszenia do podglądu:', e);
      }
    };

    fetchListing();
  }, [listingId]);

  const socketRef = useRef<any>(null);
  useEffect(() => {
    if (!user) return;

    const socket = io(API_BASE, {
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('auth:join', user.id);
    });

    socket.on('chat:new-message', (msg: any) => {
      if (msg.listing_id !== listingId) return;
      setMessages((prev) => [...prev, msg]);
    });


    socket.on('chat:typing', (payload: any) => {
      const { fromUserId, listingId: msgListingId } = payload || {};
      if (!user) return;
      if (msgListingId !== listingId) return;
      if (fromUserId === user.id) return; 

      setRemoteTyping(true);
      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
      }
      remoteTypingTimeoutRef.current = window.setTimeout(() => {
        setRemoteTyping(false);
      }, 2000);
    });

    socket.on('disconnect', () => {
      socketRef.current = null;
    });

    return () => {
      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
      }
      socket.disconnect();
    };
  }, [user, listingId]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
      }
    };
  }, []);

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

  const sendMessage = async () => {
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
      setIsTyping(false);
    } catch (err) {
      console.error('Błąd podczas wysyłania wiadomości:', err);
    } finally {
      setSending(false);
    }
  };


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage();
  };

  const handleTypingChange = (value: string) => {
    setContent(value);

    if (!isTyping) {
      setIsTyping(true);
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
    }, 1500);

    if (socketRef.current && user && peerId && listingId) {
      socketRef.current.emit('chat:typing', {
        fromUserId: user.id,
        toUserId: peerId,
        listingId,
      });
    }
  };

if (!listingId) {
  return <p className="messages-conv-error">Nieprawidłowe ID ogłoszenia.</p>;
}

const peerAvatarSrc =
  listingInfo && listingInfo.authorAvatarUrl
    ? (listingInfo.authorAvatarUrl.startsWith('http') ||
      listingInfo.authorAvatarUrl.startsWith('data:'))
      ? listingInfo.authorAvatarUrl
      : `${API_BASE}${listingInfo.authorAvatarUrl}`
    : null;

const typeIcon = getTypeIconSrc(listingInfo?.typeId);
  return (
    <div className="messages-conv-page">
      <div className="messages-conv-header">
        <h2>Czat dotyczący ogłoszenia</h2>

        <div className="messages-conv-header-row">
          <div className="messages-conv-user-block">
            <div className="messages-conv-avatar">
              {peerAvatarSrc ? (
                <img
                  src={peerAvatarSrc}
                  alt={`Avatar użytkownika ${peerName || ''}`}
                  className="messages-conv-avatar-img"
                />
              ) : peerName ? (
                getInitials(peerName)
              ) : (
                '?'
              )}
            </div>
            <div className="messages-conv-user-text">
              <span className="messages-conv-peer-line">
                Rozmowa z{' '}
                <span className="messages-conv-peer-name">
                  {peerName || 'użytkownikiem'}
                </span>
              </span>
            </div>
          </div>

          <Link
            to={`/listing/${listingId}`}
            className="messages-conv-listing-preview"
          >
            {listingInfo?.thumbnailUrl || listingInfo?.imageUrl ? (
              <img
                src={listingInfo.thumbnailUrl || listingInfo.imageUrl || ''}
                alt={listingInfo.title || 'Ogłoszenie'}
                className="messages-conv-listing-thumb"
              />
            ) : typeIcon ? (
              <img
                src={typeIcon}
                alt="Ikona typu ogłoszenia"
                className="messages-conv-listing-thumb"
                style={{ objectFit: 'contain', padding: '6px' }}
              />
            ) : (
              <div className="messages-conv-listing-thumb placeholder">
                brak zdjęcia
              </div>
            )}
            <div className="messages-conv-listing-text">
              <span className="messages-conv-listing-title">
                {listingInfo?.title || 'Tytuł ogłoszenia'}
              </span>
              <span className="messages-conv-listing-link-text">
                Zobacz szczegóły
              </span>
            </div>
          </Link>
        </div>
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
            <div ref={bottomRef} />
          </div>

          <form className="messages-conv-form" onSubmit={handleSend}>
            {/* Wskaźnik pisania */}
            <div className="messages-conv-typing">
              {remoteTyping
                ? `${peerName || 'Użytkownik'} pisze…`
                : isTyping
                ? 'Piszesz…'
                : '\u00A0'}
            </div>

            <textarea
              className="messages-conv-textarea"
              placeholder="Napisz odpowiedź..."
              value={content}
              onChange={(e) => handleTypingChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending && content.trim()) {
                    sendMessage();
                  }
                }
              }}
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