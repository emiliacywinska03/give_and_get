import React, { useEffect, useState } from 'react';
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
  listing_type_id?: number | null;
  listing_primary_image?: string | null;

  type_id?: number | null;
  listing_type?: number | null;
  listing_typeId?: number | null;
  title?: string;
  listing?: { title?: string; type_id?: number | null; primary_image?: string | null };
};

const stripOfferMeta = (text: string) =>
  String(text || '')
    .replace(/\n?\[OFFER_ID:\d+\]\s*/g, '')
    .replace(/\n?\[OFFER_STATUS:(accepted|rejected)\]\s*/g, '')
    .replace(/\n?\[OFFER_PRICE:[0-9]+(?:\.[0-9]+)?\]\s*/g, '')
    .trim();


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
  if (typeId === 3) return '/icons/work-case-filled-svgrepo-com.svg';
  if (typeId === 2) return '/icons/hands-holding-heart-svgrepo-com.svg';
  return null;
};

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<ThreadItem[]>([]);
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
          Tu zobaczysz wszystkie wiadomości wysłane i otrzymane, wraz z ogłoszeniem, którego dotyczą.
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

            const listingTitle =
              t.listing_title ||
              (t as any).title ||
              (t as any).listing?.title ||
              'Ogłoszenie';

            const listingTypeId =
              t.listing_type_id ??
              (t as any).type_id ??
              (t as any).listing_type ??
              (t as any).listing_typeId ??
              (t as any).listing?.type_id ??
              null;

            const listingPrimaryImage =
              t.listing_primary_image ??
              (t as any).primary_image ??
              (t as any).listing?.primary_image ??
              null;

            const thumb = toSrc(listingPrimaryImage);
            const typeIcon = getTypeIconSrc(
              typeof listingTypeId === 'string' ? Number(listingTypeId) : listingTypeId
            );

            return (
              <div
                key={`${t.listing_id}-${peerId}`}
                className={`messages-item ${incoming ? 'incoming' : 'outgoing'}`}
                onClick={() => navigate(`/messages/listing/${t.listing_id}?peer=${peerId}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="messages-item-top">
                  <span className="messages-direction">{incoming ? 'Odebrana' : 'Wysłana'}</span>
                  <span className="messages-date">{formatDate(t.created_at)}</span>
                </div>

                <div className="messages-item-middle">
                  <div className="messages-listing">
                    {(thumb || typeIcon) && (
                      <span className="messages-listing-thumb-wrapper">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={listingTitle || 'Miniaturka ogłoszenia'}
                            className="messages-listing-thumb"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : typeIcon ? (
                          <img
                            src={typeIcon}
                            alt="Ikona typu ogłoszenia"
                            className="messages-listing-thumb messages-thumb--icon"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                      </span>
                    )}

                    <div className="messages-listing-text">
                      <span className="messages-listing-label">Ogłoszenie:</span>
                      <span className="messages-listing-link">{listingTitle}</span>
                    </div>
                  </div>

                  <div className="messages-peer">
                    <span className="messages-peer-label">{incoming ? 'Od:' : 'Do:'}</span>
                    <span className="messages-peer-name">{peerName}</span>
                  </div>
                </div>

                <p className="messages-content">{stripOfferMeta(t.content)}</p>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;