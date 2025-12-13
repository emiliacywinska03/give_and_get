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

type ListingPreview = {
  id: number;
  title?: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  typeId?: number | null;
};

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

const getTypeIconSrc = (typeId?: number | null): string | null => {
  if (typeId === 3) {
    return '/icons/work-case-filled-svgrepo-com.svg';
  }
  if (typeId === 2) {
    return '/icons/hands-holding-heart-svgrepo-com.svg';
  }
  return null;
};

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [listingInfos, setListingInfos] = useState<Record<number, ListingPreview>>({});

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

  useEffect(() => {
    if (!messages.length) return;

    const uniqueListingIds = Array.from(
      new Set(messages.map((m) => m.listing_id)),
    );
    const idsToFetch = uniqueListingIds.filter(
      (id) => listingInfos[id] === undefined,
    );
    if (!idsToFetch.length) return;

    const fetchListing = async (listingId: number) => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/${listingId}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
        });
        const data = await res.json();
        if (!res.ok) return;

        const l = data.listing ?? data.data ?? data;
        if (!l) return;

        let resolvedThumb: string | null = null;
        try {
          const ri = await fetch(
            `${API_BASE}/api/listings/${listingId}/images`,
            {
              headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
              credentials: 'include',
            },
          );
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
          console.error(
            'Błąd pobierania zdjęć ogłoszenia (inbox preview):',
            e,
          );
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
        };

        setListingInfos((prev) => ({
          ...prev,
          [listingId]: preview,
        }));
      } catch (e) {
        console.error('Błąd pobierania ogłoszenia do inbox:', e);
      }
    };

    idsToFetch.forEach((id) => {
      fetchListing(id);
    });
  }, [messages, listingInfos]);

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
            const listingInfo = listingInfos[last.listing_id];
            const typeIcon = getTypeIconSrc(listingInfo?.typeId);

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
                  <div className="messages-listing">
                    {listingInfo && (listingInfo.thumbnailUrl || typeIcon) && (
                      <span className="messages-listing-thumb-wrapper">
                        {listingInfo.thumbnailUrl ? (
                          <img
                            src={listingInfo.thumbnailUrl}
                            alt={listingInfo.title || 'Miniaturka ogłoszenia'}
                            className="messages-listing-thumb"
                          />
                        ) : typeIcon ? (
                          <img
                            src={typeIcon}
                            alt="Ikona typu ogłoszenia"
                            className="messages-listing-thumb messages-thumb--icon"
                          />
                        ) : null}
                      </span>
                    )}
                    <div className="messages-listing-text">
                      <span className="messages-listing-label">Ogłoszenie:</span>
                      <span className="messages-listing-link">
                        {listingInfo?.title || last.listing_title}
                      </span>
                    </div>
                  </div>

                  <div className="messages-peer">
                    <span className="messages-peer-label">
                      {incoming ? 'Od:' : 'Do:'}
                    </span>
                    <span className="messages-peer-name">{peerName}</span>
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