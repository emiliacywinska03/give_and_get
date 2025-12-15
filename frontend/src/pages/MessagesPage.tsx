import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './MessagesPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type ThreadItem = {
  id: number;
  listing_id: number;
  sender_id: number;
  receiver_id: number;
  other_user_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  unread_count: number;
  listing_title: string;
  other_username: string;
  other_avatar_url?: string | null;
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

  const [threads, setThreads] = useState<ThreadItem[]>([]);
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

        const list = (data.threads || data.messages || []) as ThreadItem[];
        setThreads(list);
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
    if (!threads.length) return;

    const uniqueListingIds = Array.from(
      new Set(threads.map((t) => t.listing_id)),
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
  }, [threads, listingInfos]);

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
      ) : threads.length === 0 ? (
        <p className="messages-info">Nie masz jeszcze żadnych wiadomości.</p>
      ) : (
        <div className="messages-list">
          {threads.map((t) => {
            const incoming = t.receiver_id === user?.id;
            const peerId = t.other_user_id;
            const peerName = t.other_username;
            const listingInfo = listingInfos[t.listing_id];
            const typeIcon = getTypeIconSrc(listingInfo?.typeId);

            return (
              <div
                key={`${t.listing_id}-${peerId}`}
                className={`messages-item ${incoming ? 'incoming' : 'outgoing'}`}
                onClick={() =>
                  navigate(`/messages/listing/${t.listing_id}?peer=${peerId}`)
                }
                style={{ cursor: 'pointer' }}
              >
                <div className="messages-item-top">
                  <span className="messages-direction">
                    {incoming ? 'Odebrana' : 'Wysłana'}
                  </span>
                  <span className="messages-date">
                    {formatDate(t.created_at)}
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
                        {listingInfo?.title || t.listing_title}
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

                <p className="messages-content">{t.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;