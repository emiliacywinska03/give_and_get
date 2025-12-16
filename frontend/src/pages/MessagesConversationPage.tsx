import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { io } from 'socket.io-client';
import './MessagesConversationPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

const API_BASE_NO_SLASH = API_BASE.replace(/\/$/, '');

const joinApiUrl = (p: string) => {
  if (!p) return p;
  if (p.startsWith('data:') || p.startsWith('http')) return p;
  if (p.startsWith('/')) return `${API_BASE_NO_SLASH}${p}`;
  return `${API_BASE_NO_SLASH}/${p}`;
};

type ChatMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  listing_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_username?: string;
  receiver_username?: string;
};

type ListingPreview = {
  id: number;
  title?: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  typeId?: number | null;
  authorUsername?: string;
  authorAvatarUrl?: string | null;
  authorId?: number | null;
};

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]);
  return letters.join('').toUpperCase();
};

const resolvePeerNameFromMessages = (msgs: ChatMessage[], currentUserId: number) => {
  const last = msgs[msgs.length - 1];
  if (!last) return '';
  if (last.sender_id === currentUserId) return last.receiver_username || '';
  return last.sender_username || '';
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

    if (listingInfo?.authorUsername) return listingInfo.authorUsername;

    const fromMsgs = resolvePeerNameFromMessages(messages, user.id);
    if (fromMsgs) return fromMsgs;

    return '';
  }, [messages, user, listingInfo]);
  

  const parseOfferStatus = (text: string): 'accepted' | 'rejected' | null => {
    const m = String(text || '').match(/\[OFFER_STATUS:(accepted|rejected)\]/);
    return (m?.[1] as any) ?? null;
  };

  const parseOfferId = (text: string): number | null => {
    const m = String(text || '').match(/\[OFFER_ID:(\d+)\]/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  
  
  const parseOfferPrice = (text: string): number | null => {
    const m = String(text || '').match(/\[OFFER_PRICE:([0-9]+(?:\.[0-9]+)?)\]/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  
  const stripOfferMeta = (text: string) =>
    String(text || '')
      .replace(/\n?\[OFFER_ID:\d+\]\s*/g, '')
      .replace(/\n?\[OFFER_STATUS:(accepted|rejected)\]\s*/g, '')
      .replace(/\n?\[OFFER_PRICE:[0-9]+(?:\.[0-9]+)?\]\s*/g, '')
      .trim();
  
  
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

    const controller = new AbortController();

    const fetchConversation = async () => {
      try {
        setLoading(true);
        setError(null);

        const qs = new URLSearchParams();
        qs.set('limit', '50');
        if (peerId) qs.set('otherUserId', String(peerId));

        const res = await fetch(`${API_BASE}/api/messages/listing/${listingId}?${qs.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
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

        const msgs: ChatMessage[] = data.messages || [];
        setMessages(msgs);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Błąd pobierania konwersacji:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania konwersacji.');
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();

    return () => {
      controller.abort();
    };
  }, [user, listingId, peerId, navigate]);

  useEffect(() => {
    if (!listingId) return;

    const controller = new AbortController();

    const fetchListing = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/${listingId}`, {
          credentials: 'include',
          signal: controller.signal,
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

        const rawPrimary =
          l.primary_image ??
          l.primaryImage ??
          l.listing_primary_image ??
          l.listingPrimaryImage ??
          (Array.isArray(l.images) && l.images.length ? l.images[0] : null);

        const resolvedImageUrl =
          typeof rawPrimary === 'string'
            ? rawPrimary.startsWith('data:') || rawPrimary.startsWith('http')
              ? rawPrimary
              : joinApiUrl(rawPrimary)
            : rawPrimary && typeof rawPrimary === 'object'
            ? (rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path
                ? (String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path).startsWith('data:') ||
                   String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path).startsWith('http')
                    ? String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path)
                    : joinApiUrl(String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path)))
                : null)
            : null;

        const typeIdValue =
          typeof l.type_id === 'number'
            ? l.type_id
            : typeof l.typeId === 'number'
            ? l.typeId
            : null;

        let finalImageUrl = resolvedImageUrl;
        
        if (!finalImageUrl && typeIdValue === 1) {
          try {
            const ri = await fetch(`${API_BASE_NO_SLASH}/api/listings/${listingId}/images`, {
              credentials: 'include',
              signal: controller.signal,
              headers: {
                ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
              },
            });
            if (ri.ok) {
              const imgs = await ri.json();
              if (Array.isArray(imgs) && imgs.length > 0) {
                const first = imgs[0];
                const raw =
                  (first && (first.dataUrl || first.url || first.path)) ||
                  (typeof first === 'string' ? first : null);
                if (raw) finalImageUrl = joinApiUrl(String(raw));
              }
            }
          } catch (e: any) {
            if (e?.name !== 'AbortError') {
              console.error('Błąd pobierania miniaturki sprzedaży (fallback):', e);
            }
          }
        }

        const preview: ListingPreview = {
          id: l.id,
          title: l.title || '',
          imageUrl: finalImageUrl,
          thumbnailUrl: finalImageUrl,
          typeId: typeIdValue,
          authorUsername: l.author_username || l.authorUsername || '',
          authorAvatarUrl: l.author_avatar_url || l.authorAvatarUrl || null,
          authorId: l.user_id ?? l.author_id ?? null,
        };

        setListingInfo(preview);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('Błąd pobierania ogłoszenia do podglądu:', e);
      }
    };

    fetchListing();

    return () => {
      controller.abort();
    };
  }, [listingId]);

  const socketRef = useRef<any>(null);
  useEffect(() => {
    if (!user) return;

    const socket = io(API_BASE, {
      withCredentials: true,
      transports: ['websocket'],
      upgrade: false,
      timeout: 10000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('auth:join', user.id);
    });

    socket.on('chat:new-message', (msg: any) => {
      if (msg.listing_id !== listingId) return;
    
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;

        const enriched: ChatMessage = {
          ...msg,
          sender_username: msg.sender_username,
          receiver_username: msg.receiver_username,
        };

        return [...prev, enriched];
      });
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
      socketRef.current = null;
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

      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      setContent('');
      setIsTyping(false);
    } catch (err) {
      console.error('Błąd podczas wysyłania wiadomości:', err);
    } finally {
      setSending(false);
    }
  };


  const acceptOffer = async (offerId: number, buyerId: number) => {
    if (!user) return;
  
    const res = await fetch(`${API_BASE}/api/price-offers/${offerId}/accept`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    });
  
    const p = await res.json().catch(() => null);
    if (!res.ok || !p?.ok) {
      alert(p?.error || 'Nie udało się zaakceptować oferty.');
      return;
    }
  
    // jeśli backend zwraca cenę (polecam dodać), to bierzemy ją stąd
    const newPrice = p?.price ?? p?.offer?.price ?? null;
  
    const text =
      `Oferta została zaakceptowana.` +
      (newPrice ? ` Nowa cena: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(newPrice)}.` : '');
  
    // Wyślij wiadomość do kupującego jako normalną wiadomość czatu
    const msgRes = await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: JSON.stringify({
        listingId,
        receiverId: buyerId,
        content: `${text}\n[OFFER_STATUS:accepted][OFFER_ID:${offerId}]${newPrice ? `[OFFER_PRICE:${newPrice}]` : ''}`,
      }),
    });
  
    const msgPayload = await msgRes.json().catch(() => null);
    if (msgRes.ok && msgPayload?.ok && msgPayload?.message) {
      setMessages((prev) => [...prev, msgPayload.message]); // ma id -> TS nie krzyczy
    }
  
    alert('Zaakceptowano ofertę.');
  };
  
  const rejectOffer = async (offerId: number, buyerId: number) => {
    if (!user) return;
  
    const res = await fetch(`${API_BASE}/api/price-offers/${offerId}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    });
  
    const p = await res.json().catch(() => null);
    if (!res.ok || !p?.ok) {
      alert(p?.error || 'Nie udało się odrzucić oferty.');
      return;
    }
  
    const msgRes = await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: JSON.stringify({
        listingId,
        receiverId: buyerId,
        content: `Oferta została odrzucona.\n[OFFER_STATUS:rejected][OFFER_ID:${offerId}]`,
      }),
    });
  
    const msgPayload = await msgRes.json().catch(() => null);
    if (msgRes.ok && msgPayload?.ok && msgPayload?.message) {
      setMessages((prev) => [...prev, msgPayload.message]);
    }
  
    alert('Odrzucono ofertę.');
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
    ? joinApiUrl(listingInfo.authorAvatarUrl)
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
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
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
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                }}
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
              
                const offerId = parseOfferId(m.content);
                const status = parseOfferStatus(m.content);
                const offerPrice = parseOfferPrice(m.content);
                const cleanText = stripOfferMeta(m.content);

              
                return (
                  <div
                    key={m.id}
                    className={`messages-conv-bubble ${mine ? 'mine' : 'theirs'}`}
                  >
                    <div className="messages-conv-bubble-header">
                      <span className="messages-conv-author">
                        {mine ? 'Ty' : (m.sender_username || 'Użytkownik')}
                      </span>
                      <span className="messages-conv-date">
                        {formatDate(m.created_at)}
                      </span>
                    </div>
              
                    <div className="messages-conv-text">{cleanText}</div>
              
                    {status && (
                      <div className={`offer-status-badge ${status}`}>
                        {status === 'accepted'
                          ? `✅ Oferta zaakceptowana${offerPrice ? ` (${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(offerPrice)})` : ''}`
                          : '❌ Oferta odrzucona'}
                      </div>
                    )}

                    {offerId && listingInfo?.authorId === user?.id && !status && (
                      <div className="offer-actions">
                        <button
                          type="button"
                          className="offer-btn accept"
                          onClick={() => acceptOffer(offerId, m.sender_id)}
                        >
                          Akceptuj
                        </button>
                        <button
                          type="button"
                          className="offer-btn reject"
                          onClick={() => rejectOffer(offerId, m.sender_id)}
                        >
                          Odrzuć
                        </button>
                      </div>
                    )}

                  </div>
                );
              })
              
            )}
            <div ref={bottomRef} />
          </div>

          <form className="messages-conv-form" onSubmit={handleSend}>
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