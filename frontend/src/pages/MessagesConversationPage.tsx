import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  delivered_at?: string | null;
  read_at?: string | null;
  sender_username?: string;
  receiver_username?: string;
  sender_avatar_url?: string | null;
  receiver_avatar_url?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
};

type ListingPreview = {
  id: number;
  title?: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  typeId?: number | null;
  price?: number | null;
  currency?: string | null;
};

type PriceNegotiation = {
  id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  status: 'open' | 'accepted' | 'rejected';
  accepted_offer_id?: number | null;
  created_at: string;
  updated_at: string;
};

type PriceOffer = {
  id: number;
  negotiation_id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  proposed_by: 'buyer' | 'seller';
  created_at: string;
};

type PeerInfo = { id: number; username: string; avatar_url: string | null } | null;

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]);
  return letters.join('').toUpperCase();
};

const getTypeIconSrc = (typeId?: number | null): string | null => {
  if (typeId === 3) return '/icons/work-case-filled-svgrepo-com.svg';
  if (typeId === 2) return '/icons/hands-holding-heart-svgrepo-com.svg';
  return null;
};


const AcceptedIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="10" fill="#16a34a" />
    <path
      d="M7 12.5l3 3 7-7"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);


const IconTag: React.FC<{ kind: 'money' | 'check' | 'x' | 'clock' }> = ({ kind }) => {
  if (kind === 'money') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7h18v10H3V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M7 12h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M17 12h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'check') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === 'x') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M18 6 6 18M6 6l12 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 6v6l4 2"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
};

const normalizeNegotiation = (n: any): PriceNegotiation | null => {
  if (!n) return null;
  return {
    ...n,
    id: Number(n.id),
    listing_id: Number(n.listing_id),
    buyer_id: Number(n.buyer_id),
    seller_id: Number(n.seller_id),
    accepted_offer_id: n.accepted_offer_id != null ? Number(n.accepted_offer_id) : null,
  };
};

const normalizeOffers = (arr: any[]): PriceOffer[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map((o: any) => ({
    ...o,
    id: Number(o.id),
    negotiation_id: Number(o.negotiation_id),
    listing_id: Number(o.listing_id),
    buyer_id: Number(o.buyer_id),
    seller_id: Number(o.seller_id),
    price: Number(o.price),
  }));
};

const MessagesConversationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [content, setContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const remoteTypingTimeoutRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [offerInput, setOfferInput] = useState('');
  const [offerSending, setOfferSending] = useState(false);

  const [showPayment, setShowPayment] = useState(false);
  const [blikCode, setBlikCode] = useState('');
  const [blikError, setBlikError] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);

  const [helpApplyExpanded, setHelpApplyExpanded] = useState<Record<number, boolean>>({});

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);


  const listingId = Number(id);

  const queryClient = useQueryClient();

  const peerIdFromQuery = useMemo(() => {
    const v = searchParams.get('peer');
    if (!v) return null;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const conversationQueryKey = useMemo(() => ['messages', 'conversation', listingId, peerIdFromQuery], [listingId, peerIdFromQuery]);
  const inboxQueryKey = useMemo(() => ['messages', 'inbox'], []);

  const { data: conversationData, isPending: loadingConversation, error: conversationError } = useQuery<
    { messages: ChatMessage[]; peer: PeerInfo },
    Error
  >({
    queryKey: conversationQueryKey,
    enabled: !!user && !!listingId,
    staleTime: 5_000,
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('limit', '50');
      if (peerIdFromQuery) qs.set('otherUserId', String(peerIdFromQuery));

      const res = await fetch(`${API_BASE}/api/messages/listing/${listingId}?${qs.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg = data?.error || 'Nie udało się pobrać wiadomości.';
        throw new Error(msg);
      }

      return { messages: (data.messages || []) as ChatMessage[], peer: (data.peer ?? null) as PeerInfo };
    },
  });

  const messages = conversationData?.messages ?? [];
  const peerInfo = conversationData?.peer ?? null;

  const resolvedPeerId = useMemo(() => {
    if (peerIdFromQuery) return peerIdFromQuery;
    if (peerInfo?.id) return peerInfo.id;

    if (user && messages.length > 0) {
      const last = messages[messages.length - 1];
      const other = last.sender_id === user.id ? last.receiver_id : last.sender_id;
      return Number.isFinite(other) ? other : null;
    }

    return null;
  }, [peerIdFromQuery, peerInfo, messages, user]);


  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  const { data: listingInfo } = useQuery<ListingPreview | null, Error>({
    queryKey: ['listing', 'preview', listingId],
    enabled: !!listingId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/listings/${listingId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) return null;

      const l = data?.listing ?? data?.data ?? data;
      if (!l) return null;

      const rawPrimary =
        l.primary_image ??
        l.primaryImage ??
        l.listing_primary_image ??
        l.listingPrimaryImage ??
        (Array.isArray(l.images) && l.images.length ? l.images[0] : null);

        const rawPrice =
          typeof l.price === 'number'
            ? l.price
            : typeof l.price === 'string'
              ? Number(l.price)
              : typeof l.current_price === 'number'
                ? l.current_price
                : typeof l.currentPrice === 'number'
                  ? l.currentPrice
                  : null;

        const rawCurrency =
          (typeof l.currency === 'string' && l.currency) ||
          (typeof l.price_currency === 'string' && l.price_currency) ||
          (typeof l.priceCurrency === 'string' && l.priceCurrency) ||
          'PLN';

          
      const resolvedImageUrl =
        typeof rawPrimary === 'string'
          ? rawPrimary.startsWith('data:') || rawPrimary.startsWith('http')
            ? rawPrimary
            : joinApiUrl(rawPrimary)
          : rawPrimary && typeof rawPrimary === 'object'
            ? rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path
              ? String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path).startsWith('data:') ||
                String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path).startsWith('http')
                ? String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path)
                : joinApiUrl(String(rawPrimary.dataUrl || rawPrimary.url || rawPrimary.path))
              : null
            : null;

      const typeIdValue =
        typeof l.type_id === 'number' ? l.type_id : typeof l.typeId === 'number' ? l.typeId : null;

      let finalImageUrl = resolvedImageUrl;

      if (!finalImageUrl && typeIdValue === 1) {
        try {
          const ri = await fetch(`${API_BASE_NO_SLASH}/api/listings/${listingId}/images`, {
            credentials: 'include',
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
        } catch {
          return {
            id: Number(l.id),
            title: l.title || '',
            imageUrl: finalImageUrl,
            thumbnailUrl: finalImageUrl,
            typeId: typeIdValue,
            price: Number.isFinite(rawPrice as number) ? (rawPrice as number) : null,
            currency: rawCurrency,
          };
          
        }
      }

      return {
        id: Number(l.id),
        title: l.title || '',
        imageUrl: finalImageUrl,
        thumbnailUrl: finalImageUrl,
        typeId: typeIdValue,
        price: Number.isFinite(rawPrice as number) ? (rawPrice as number) : null,
        currency: rawCurrency,
      };
      
    },
  });

  const negotiationQueryKey = useMemo(
    () => ['price-negotiation', listingId, resolvedPeerId],
    [listingId, resolvedPeerId]
  );

  const { data: negotiationData, isPending: negoLoading } = useQuery<
    { negotiation: PriceNegotiation | null; offers: PriceOffer[] },
    Error
  >({
    queryKey: negotiationQueryKey,
    enabled: !!user && !!listingId && !!resolvedPeerId,
    staleTime: 5_000,
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('listingId', String(listingId));
      qs.set('otherUserId', String(resolvedPeerId));

      const res = await fetch(`${API_BASE}/api/price-offers/negotiation?${qs.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        return { negotiation: null, offers: [] };
      }

      return {
        negotiation: normalizeNegotiation(data.negotiation),
        offers: normalizeOffers(data.offers),
      };
    },
  });

  const negotiation = negotiationData?.negotiation ?? null;
  const offers = negotiationData?.offers ?? [];

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
      if (Number(msg?.listing_id) !== listingId) return;

      queryClient.setQueryData(conversationQueryKey, (prev: any) => {
        const prevMessages: ChatMessage[] = prev?.messages || [];
        if (prevMessages.some((m) => m.id === Number(msg.id))) return prev;
        return { ...(prev || {}), messages: [...prevMessages, msg as ChatMessage], peer: prev?.peer ?? peerInfo ?? null };
      });

      queryClient.invalidateQueries({ queryKey: inboxQueryKey });
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

    socket.on('chat:delivered', (payload: any) => {
  const { listingId: msgListingId, byUserId } = payload || {};
  if (!user) return;
  if (Number(msgListingId) !== listingId) return;
  if (!byUserId) return;

  queryClient.setQueryData(conversationQueryKey, (prev: any) => {
    const prevMessages: ChatMessage[] = prev?.messages || [];
    const next = prevMessages.map((m) => {
      if (m.sender_id === user.id && m.receiver_id === Number(byUserId) && Number(m.listing_id) === listingId) {
        if (!m.delivered_at) return { ...m, delivered_at: new Date().toISOString() };
      }
      return m;
    });
    return { ...(prev || {}), messages: next, peer: prev?.peer ?? peerInfo ?? null };
  });

  queryClient.invalidateQueries({ queryKey: inboxQueryKey });
});

socket.on('chat:read', (payload: any) => {
  const { listingId: msgListingId, byUserId } = payload || {};
  if (!user) return;
  if (Number(msgListingId) !== listingId) return;
  if (!byUserId) return;

  queryClient.setQueryData(conversationQueryKey, (prev: any) => {
    const prevMessages: ChatMessage[] = prev?.messages || [];
    const nowIso = new Date().toISOString();
    const next = prevMessages.map((m) => {
      if (m.sender_id === user.id && m.receiver_id === Number(byUserId) && Number(m.listing_id) === listingId) {
        return {
          ...m,
          is_read: true,
          delivered_at: m.delivered_at || nowIso,
          read_at: m.read_at || nowIso,
        };
      }
      return m;
    });
    return { ...(prev || {}), messages: next, peer: prev?.peer ?? peerInfo ?? null };
  });

  queryClient.invalidateQueries({ queryKey: inboxQueryKey });
});

    socket.on('disconnect', () => {
      socketRef.current = null;
    });

    return () => {
      if (remoteTypingTimeoutRef.current) window.clearTimeout(remoteTypingTimeoutRef.current);
      socketRef.current = null;
      socket.disconnect();
    };
  }, [user, listingId, conversationQueryKey, peerInfo, queryClient, inboxQueryKey]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (remoteTypingTimeoutRef.current) window.clearTimeout(remoteTypingTimeoutRef.current);
    };
  }, []);

  const peerName = useMemo(() => {
    if (peerInfo?.username) return peerInfo.username;

    if (user && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.sender_id === user.id) return last.receiver_username || 'Użytkownik';
      return last.sender_username || 'Użytkownik';
    }

    return 'Użytkownik';
  }, [peerInfo, messages, user]);

  const peerAvatarSrc = useMemo(() => {
    if (peerInfo?.avatar_url) return joinApiUrl(peerInfo.avatar_url);

    if (user && messages.length > 0) {
      const last = messages[messages.length - 1];
      const mine = last.sender_id === user.id;
      const av = mine ? last.receiver_avatar_url : last.sender_avatar_url;
      return av ? joinApiUrl(av) : null;
    }

    return null;
  }, [peerInfo, messages, user]);

  const typeIcon = getTypeIconSrc(listingInfo?.typeId);

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

  const renderHelpApplyCard = (m: ChatMessage, parsed: HelpApplyCardData) => {
  const expanded = !!helpApplyExpanded[m.id];

  const chips = (arr?: string[]) =>
    (arr || []).map((t) => (
      <span key={t} className="messages-conv-apply-chip">
        {t}
      </span>
    ));

  return (
    <div className="messages-conv-apply-card" role="group" aria-label="Zgłoszenie">
      <div className="messages-conv-apply-head">
        <div className="messages-conv-apply-head-left">
          <span className="messages-conv-apply-icon" aria-hidden="true">
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g strokeWidth="0" />
    <g strokeLinecap="round" strokeLinejoin="round" />
    <g>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.583 1.41995C16.895 1.86149 17.7501 3.09602 17.7501 4.71455C17.7501 5.73209 17.1716 6.66866 16.527 7.41588C15.8644 8.184 15.0257 8.8733 14.2921 9.40806C14.2607 9.43097 14.2295 9.45375 14.1986 9.47635C13.4866 9.99659 12.8992 10.4258 12.0001 10.4258C11.1009 10.4258 10.5135 9.99659 9.80154 9.47634C9.77061 9.45374 9.73944 9.43097 9.708 9.40805C8.97441 8.87329 8.13575 8.18399 7.47311 7.41587C6.82851 6.66865 6.25006 5.73209 6.25006 4.71456C6.25006 3.09603 7.10508 1.8615 8.41713 1.41996C9.5362 1.04335 10.8388 1.29193 12.0001 2.13723C13.1613 1.29193 14.4639 1.04335 15.583 1.41995ZM15.1046 2.84161C14.4525 2.62218 13.4802 2.76414 12.5076 3.65812C12.2206 3.92189 11.7795 3.92189 11.4925 3.65812C10.5199 2.76414 9.5476 2.62218 8.89556 2.84161C8.27008 3.0521 7.75006 3.65592 7.75006 4.71456C7.75006 5.18213 8.03458 5.77033 8.60889 6.43607C9.16518 7.08091 9.90138 7.69278 10.5916 8.19592C11.4347 8.81053 11.6351 8.92578 12.0001 8.92578C12.365 8.92578 12.5654 8.81054 13.4085 8.19593C14.0987 7.69279 14.8349 7.08093 15.3912 6.43609C15.9655 5.77034 16.2501 5.18213 16.2501 4.71455C16.2501 3.65592 15.73 3.0521 15.1046 2.84161ZM8.68397 14.448C10.5498 14.0865 12.5471 14.1676 14.1633 15.1316C14.3903 15.267 14.6031 15.4357 14.7888 15.6442C15.1646 16.0664 15.3588 16.5911 15.3679 17.1172C15.5592 16.9938 15.7508 16.8568 15.9454 16.7098L17.7526 15.3446C18.6572 14.6613 19.9718 14.6612 20.8765 15.3443C21.7125 15.9755 22.0457 17.1083 21.4473 18.0675C21.022 18.7493 20.3815 19.6922 19.7296 20.296C19.0707 20.9063 18.1329 21.4194 17.4236 21.7618C16.5621 22.1776 15.6316 22.4075 14.7269 22.5539C12.8777 22.8532 10.9535 22.8074 9.12505 22.4308C8.19064 22.2382 7.21961 22.1382 6.25999 22.1382H4.00006C3.58585 22.1382 3.25006 21.8024 3.25006 21.3882C3.25006 20.974 3.58585 20.6382 4.00006 20.6382H6.25999C7.3221 20.6382 8.39454 20.7487 9.42772 20.9616C11.0798 21.302 12.8202 21.343 14.4872 21.0732C15.3161 20.939 16.0901 20.7398 16.7715 20.4109C17.4549 20.081 18.2233 19.6466 18.7104 19.1955C19.2029 18.7393 19.7541 17.9477 20.1747 17.2736C20.3016 17.0701 20.284 16.7765 19.9727 16.5414C19.6029 16.2622 19.0264 16.2623 18.6567 16.5415L16.8496 17.9067C16.1281 18.4516 15.2402 19.0347 14.1388 19.2103Z"
        fill="#1C274C"
      />
    </g>
  </svg>
</span>
          <span className="messages-conv-apply-title">Zgłoszenie</span>
        </div>

        <Link
          to={`/listing/${m.listing_id}`}
          className="messages-conv-apply-listing"
          title="Zobacz szczegóły ogłoszenia"
        >
          {parsed.listingTitle || listingInfo?.title || 'Zobacz szczegóły'}
        </Link>
      </div>

      <div className="messages-conv-apply-body">
        <div className="messages-conv-apply-row">
          {parsed.intent ? <span className="messages-conv-apply-pill">{parsed.intent}</span> : null}
        </div>

        {(parsed.availability?.length || parsed.contact?.length) ? (
          <div className="messages-conv-apply-grid">
            {parsed.availability?.length ? (
              <div className="messages-conv-apply-section">
                <div className="messages-conv-apply-label">Dostępność</div>
                <div className="messages-conv-apply-chips">{chips(parsed.availability)}</div>
              </div>
            ) : null}

            {parsed.contact?.length ? (
              <div className="messages-conv-apply-section">
                <div className="messages-conv-apply-label">Kontakt</div>
                <div className="messages-conv-apply-chips">{chips(parsed.contact)}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {(parsed.phone || parsed.email) ? (
          <div className="messages-conv-apply-contacts">
            {parsed.phone ? (
              <div className="messages-conv-apply-contact-line">
                <span className="messages-conv-apply-contact-ico" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6.6 10.2c1.4 2.8 3.7 5.1 6.5 6.5l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.3 21 3 12.7 3 2c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{parsed.phone}</span>
              </div>
            ) : null}

            {parsed.email ? (
              <div className="messages-conv-apply-contact-line">
                <span className="messages-conv-apply-contact-ico" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 6h16v12H4V6Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m4 7 8 6 8-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{parsed.email}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {parsed.needText ? (
          <div className="messages-conv-apply-need">
            <div className="messages-conv-apply-label">Czego potrzebuję</div>
            <div className={`messages-conv-apply-need-text ${expanded ? 'expanded' : ''}`}>
              {parsed.needText}
            </div>
            <button
              type="button"
              className="messages-conv-apply-more"
              onClick={() => setHelpApplyExpanded((p) => ({ ...p, [m.id]: !p[m.id] }))}
            >
              {expanded ? 'Zwiń' : 'Pokaż więcej'}
            </button>
          </div>
        ) : null}

        {parsed.note ? <div className="messages-conv-apply-note">{parsed.note}</div> : null}
      </div>
    </div>
  );
};

  const getMyMessageStatus = (m: ChatMessage) => {
  const read = !!(m.read_at || m.is_read);
  const delivered = !!m.delivered_at;

  if (read) return { text: 'Odczytana', kind: 'read' as const, icon: '✓✓' };
  if (delivered) return { text: 'Dostarczona', kind: 'delivered' as const, icon: '✓✓' };
  return { text: 'Wysłana', kind: 'sent' as const, icon: '✓' };
}

type HelpApplyCardData = {
  listingTitle?: string;
  intent?: string; 
  availability?: string[];
  contact?: string[];
  phone?: string;
  email?: string;
  needText?: string;
  note?: string;
};

const parseHelpApplyMessage = (content: string): HelpApplyCardData | null => {
  const raw = (content || '').replace(/\r\n/g, '\n');
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;
  if (!/^Zgłoszenie do ogłoszenia:/i.test(lines[0])) return null;

  const first = lines[0];
  const titleMatch =
    first.match(/Zgłoszenie do ogłoszenia:\s*\"([^\"]+)\"/i) ||
    first.match(/Zgłoszenie do ogłoszenia:\s*(.+)$/i);

  const listingTitle = titleMatch
    ? (titleMatch[1] || first.replace(/^Zgłoszenie do ogłoszenia:\s*/i, '')).trim()
    : undefined;

  const out: HelpApplyCardData = { listingTitle };

  const takeList = (value: string) =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const stripBullet = (l: string) => l.replace(/^•\s*/, '').replace(/^-+\s*/, '').trim();

  for (let i = 1; i < lines.length; i++) {
    const l0 = stripBullet(lines[i]);

    if (/^Dostępność\s*:/i.test(l0)) {
      out.availability = takeList(l0.replace(/^Dostępność\s*:\s*/i, ''));
      continue;
    }

    if (/^Preferowany kontakt\s*:/i.test(l0)) {
      out.contact = takeList(l0.replace(/^Preferowany kontakt\s*:\s*/i, ''));
      continue;
    }

    if (/^Telefon\s*:/i.test(l0)) {
      out.phone = l0.replace(/^Telefon\s*:\s*/i, '').trim();
      continue;
    }

    if (/^E-?mail\s*:/i.test(l0)) {
      out.email = l0.replace(/^E-?mail\s*:\s*/i, '').trim();
      continue;
    }

    if (/^Czego potrzebuję\s*:/i.test(l0)) {
      out.needText = l0.replace(/^Czego potrzebuję\s*:\s*/i, '').trim();
      continue;
    }

    if (/^(Chcę pomóc|Potrzebuję pomocy|Pomoc za pomoc)$/i.test(l0)) {
      out.intent = l0;
      continue;
    }

    if (!out.note) out.note = l0;
  }

  return out;
};

  const sendMutation = useMutation<ChatMessage, Error, { text: string; file?: File | null }>({
    mutationFn: async ({ text, file }) => {
      if (!user) throw new Error('Brak sesji');
      if (!listingId) throw new Error('Brak listingId');

      const trimmed = (text || '').trim();
      const hasFile = !!file;

      if (!trimmed && !hasFile) throw new Error('Pusta wiadomość');

      const url = `${API_BASE}/api/messages`;

      let res: Response;

      if (hasFile) {
        const form = new FormData();
        form.append('listingId', String(listingId));
        form.append('receiverId', String(resolvedPeerId || ''));
        form.append('content', trimmed);
        form.append('attachment', file as File);

        res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
          body: form,
        });
      } else {
        res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
          body: JSON.stringify({
            listingId,
            content: trimmed,
            receiverId: resolvedPeerId || undefined,
          }),
        });
      }

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Nie udało się wysłać wiadomości.');
      }

      return data.message as ChatMessage;
    },
    onSuccess: (msg) => {
      queryClient.setQueryData(conversationQueryKey, (prev: any) => {
        const prevMessages: ChatMessage[] = prev?.messages || [];
        if (prevMessages.some((m) => m.id === msg.id)) return prev;
        return { ...(prev || {}), messages: [...prevMessages, msg], peer: prev?.peer ?? peerInfo ?? null };
      });
      queryClient.invalidateQueries({ queryKey: inboxQueryKey });
      setContent('');
      setIsTyping(false);
      setAttachmentFile(null);
      setAttachmentError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });
  

  const sending = sendMutation.isPending;

  const formatPLN = (n: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);

  const negotiationStatusLabel = (s: PriceNegotiation['status']) => {
    if (s === 'open') return 'W trakcie';
    if (s === 'accepted') return 'Zaakceptowana';
    return 'Odrzucona';
  };

  const negotiationStatusClass = (s: PriceNegotiation['status']) => {
    if (s === 'open') return 'open';
    if (s === 'accepted') return 'accepted';
    return 'rejected';
  };

  const submitOffer = async () => {
    if (!user || !listingId || !resolvedPeerId) return;

    const normalized = offerInput.replace(',', '.').trim();
    const n = Number(normalized);

    if (!Number.isFinite(n) || n <= 0) {
      alert('Podaj poprawną cenę.');
      return;
    }

    setOfferSending(true);
    try {
      const url = negotiation?.id
        ? `${API_BASE}/api/price-offers/${negotiation.id}/offer`
        : `${API_BASE}/api/price-offers/start`;

      const body = negotiation?.id ? { price: n } : { listingId, price: n };

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert(data?.error || 'Nie udało się wysłać oferty.');
        return;
      }

      setOfferInput('');
      queryClient.invalidateQueries({ queryKey: negotiationQueryKey });
    } finally {
      setOfferSending(false);
    }
  };

  const acceptPriceOffer = async (offerId: number) => {
    const res = await fetch(`${API_BASE}/api/price-offers/offer/${offerId}/accept`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    });

    const p = await res.json().catch(() => null);
    if (!res.ok || !p?.ok) {
      alert(p?.error || 'Nie udało się zaakceptować oferty.');
      return;
    }

    queryClient.invalidateQueries({ queryKey: negotiationQueryKey });
  };

  const rejectNegotiation = async () => {
    if (!negotiation?.id) return;

    const res = await fetch(`${API_BASE}/api/price-offers/${negotiation.id}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    });

    const p = await res.json().catch(() => null);
    if (!res.ok || !p?.ok) {
      alert(p?.error || 'Nie udało się odrzucić negocjacji.');
      return;
    }

    queryClient.invalidateQueries({ queryKey: negotiationQueryKey });
  };

  const acceptedOffer = useMemo(() => {
    if (!negotiation || negotiation.status !== 'accepted') return null;
    return offers.find((o) => o.status === 'accepted') || null;
  }, [negotiation, offers]);
  
  const acceptedPrice = acceptedOffer?.price ?? null;
  
  const showAcceptedBanner = !!acceptedOffer && negotiation?.status === 'accepted';

  const handleBuyNowClick = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (myRole !== 'buyer') return; 
    setBlikError('');
    setBlikCode('');
    setShowPayment(true);
  };
  
  const handleConfirmBlik = async () => {
    if (!/^\d{6}$/.test(blikCode)) {
      setBlikError('Kod BLIK musi mieć dokładnie 6 cyfr.');
      return;
    }
  
    try {
      setPurchaseLoading(true);
      setBlikError('');
  
      const res = await fetch(`${API_BASE}/api/listings/${listingId}/purchase`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: JSON.stringify({ blikCode }),
      });
  
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setBlikError(payload?.error || 'Błąd podczas płatności.');
        return;
      }
  
      setIsPurchased(true);
      setShowPayment(false);
      setBlikCode('');
  
      queryClient.invalidateQueries({ queryKey: negotiationQueryKey });
      queryClient.invalidateQueries({ queryKey: ['listing', 'preview', listingId] });
  
      sendMutation.mutate({ text: 'Zapłacone BLIK — kupione ' });
    } catch (e) {
      console.error(e);
      setBlikError('Wystąpił błąd podczas płatności.');
    } finally {
      setPurchaseLoading(false);
    }
  };
  

  const handlePickAttachment = (file: File | null) => {
    setAttachmentError('');
    if (!file) {
      setAttachmentFile(null);
      return;
    }

    const typeId = listingInfo?.typeId ?? null;

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAttachmentError('Plik jest za duży (max 10 MB).');
      setAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (typeId === 3) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setAttachmentError('W ogłoszeniach o pracę możesz dodać tylko CV w PDF.');
        setAttachmentFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setAttachmentFile(file);
      return;
    }

    if (typeId === 1 || typeId === 2) {
      const isImage = String(file.type || '').startsWith('image/');
      if (!isImage) {
        setAttachmentError('W tych ogłoszeniach możesz dodać tylko zdjęcie.');
        setAttachmentFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setAttachmentFile(file);
      return;
    }

    setAttachmentError('Załączniki są dostępne tylko dla ogłoszeń Praca/Pomoc/Sprzedaż.');
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const st: any = (location as any)?.state;
    if (!st) return;

    const t = typeof st.prefillText === 'string' ? st.prefillText : '';
    const f = st.prefillAttachment instanceof File ? st.prefillAttachment : null;

    if (t) setContent(t);
    if (f) handlePickAttachment(f);

    try {
      navigate(location.pathname + location.search, { replace: true, state: {} } as any);
    } catch {
    }
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = content;
    if (sending) return;
    if (!text.trim() && !attachmentFile) return;
    sendMutation.mutate({ text, file: attachmentFile });
  };
  

  const handleTypingChange = (value: string) => {
    setContent(value);
    if (!isTyping) setIsTyping(true);

    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => setIsTyping(false), 1500);

    if (socketRef.current && user && resolvedPeerId && listingId) {
      socketRef.current.emit('chat:typing', {
        fromUserId: user.id,
        toUserId: resolvedPeerId,
        listingId,
      });
    }
  };

  const myRole = useMemo<'buyer' | 'seller' | null>(() => {
    if (!user || !negotiation) return null;
    if (user.id === negotiation.buyer_id) return 'buyer';
    if (user.id === negotiation.seller_id) return 'seller';
    return null;
  }, [user, negotiation]);

  const lastOffer = offers.length > 0 ? offers[offers.length - 1] : null;

  const canRespondToLastOffer =
    negotiation?.status === 'open' &&
    !!lastOffer &&
    lastOffer.status === 'pending' &&
    !!myRole &&
    lastOffer.proposed_by !== myRole;


  const pendingOffer = useMemo(() => {
    return offers.find((o) => o.status === 'pending') || null;
  }, [offers]);

  const isWaitingForPeer =
    negotiation?.status === 'open' &&
    !!pendingOffer &&
    !!myRole &&
    pendingOffer.proposed_by === myRole;

  const offerInputsDisabled =
    offerSending ||
    !offerInput.trim() ||
    (negotiation?.status && negotiation.status !== 'open') ||
    isWaitingForPeer;

  if (!listingId) {
    return <p className="messages-conv-error">Nieprawidłowe ID ogłoszenia.</p>;
  }

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
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                />
              ) : peerName ? (
                getInitials(peerName)
              ) : (
                '?'
              )}
            </div>

            <div className="messages-conv-user-text">
              <span className="messages-conv-peer-line">
                Rozmowa z <span className="messages-conv-peer-name">{peerName || 'użytkownikiem'}</span>
              </span>
            </div>
          </div>

          <Link
            to={`/listing/${listingId}`}
            state={{
              backTo: `${location.pathname}${location.search}`,
              from: 'conversation',
              listingTitle: listingInfo?.title,
            }}
            className="messages-conv-listing-preview"
          >

            {listingInfo?.thumbnailUrl || listingInfo?.imageUrl ? (
              <img
                src={listingInfo.thumbnailUrl || listingInfo.imageUrl || ''}
                alt={listingInfo.title || 'Ogłoszenie'}
                className="messages-conv-listing-thumb"
                loading="lazy"
                decoding="async"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
              />
            ) : typeIcon ? (
              <img
                src={typeIcon}
                alt="Ikona typu ogłoszenia"
                className="messages-conv-listing-thumb"
                style={{ objectFit: 'contain', padding: '6px' }}
              />
            ) : (
              <div className="messages-conv-listing-thumb placeholder">brak zdjęcia</div>
            )}

            <div className="messages-conv-listing-text">
              <span className="messages-conv-listing-title">
                {listingInfo?.title || 'Tytuł ogłoszenia'}
              </span>

              {listingInfo?.typeId === 1 ? (
                <span className="messages-conv-listing-price">
                  {listingInfo?.price != null
                    ? new Intl.NumberFormat('pl-PL', {
                        style: 'currency',
                        currency: listingInfo.currency || 'PLN',
                      }).format(listingInfo.price)
                    : 'Cena: —'}
                </span>
              ) : null}

              <span className="messages-conv-listing-link-text">Zobacz szczegóły</span>
            </div>

          </Link>
        </div>
      </div>

      {/* PANEL NEGOCJACJI */}
      {listingInfo?.typeId === 1 && resolvedPeerId ? (
        <div className="messages-conv-negotiation">
          <div className="messages-conv-negotiation-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconTag kind="money" /> Negocjacja ceny
            </span>
          </div>

          {negoLoading ? (
            <div className="messages-conv-negotiation-meta">Ładowanie…</div>
          ) : negotiation ? (
            <div className="messages-conv-negotiation-meta">
              <span className={`messages-conv-status-badge ${negotiationStatusClass(negotiation.status)}`}>
                {negotiationStatusLabel(negotiation.status)}
              </span>
            </div>
          ) : (
            <div className="messages-conv-negotiation-meta">Brak aktywnej negocjacji.</div>
          )}

          {offers.length > 0 ? (
            <div className="messages-conv-offers">
              {offers.map((o) => (
                <div key={o.id} className="messages-conv-offer-row">
                  <span>
                    {o.proposed_by === 'buyer' ? 'Kupujący' : 'Sprzedający'}: <b>{formatPLN(o.price)}</b>
                  </span>
                  <span className="messages-conv-offer-status-icon" aria-label={o.status}>
                    {o.status === 'accepted' ? (
                      <IconTag kind="check" />
                    ) : o.status === 'rejected' ? (
                      <IconTag kind="x" />
                    ) : (
                      <IconTag kind="clock" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="messages-conv-offer-actions">
            <input
              type="text"
              inputMode="decimal"
              placeholder={isWaitingForPeer ? 'Czekasz na odpowiedź…' : 'Twoja propozycja (PLN)'}
              value={offerInput}
              onChange={(e) => setOfferInput(e.target.value)}
              disabled={(negotiation?.status && negotiation.status !== 'open') || isWaitingForPeer}
            />
            <button type="button" onClick={submitOffer} disabled={offerInputsDisabled}>
              {offerSending ? 'Wysyłanie…' : negotiation ? 'Wyślij propozycję' : 'Zaproponuj cenę'}
            </button>
          </div>

          {isWaitingForPeer ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                opacity: 0.85,
              }}
            >
              Wysłałaś już ofertę. Poczekaj na akceptację / odrzucenie lub kontrpropozycję drugiej strony.
            </div>
          ) : null}

          {canRespondToLastOffer ? (
            <div className="messages-conv-offer-admin-actions">
              <button type="button" onClick={() => acceptPriceOffer(lastOffer!.id)}>
                Akceptuj ofertę
              </button>
              <button type="button" onClick={rejectNegotiation}>
                Odrzuć negocjację
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {loadingConversation ? (
        <p className="messages-conv-info">Ładowanie konwersacji...</p>
      ) : conversationError ? (
        <p className="messages-conv-error">{conversationError.message}</p>
      ) : (
        <>
          <div className="messages-conv-thread">
            {showAcceptedBanner && (
              <div className="messages-conv-system-card">
                <div className="messages-conv-system-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AcceptedIcon />
                  <span>
                    Cena zaakceptowana:{' '}
                    <b>{acceptedPrice != null ? formatPLN(acceptedPrice) : '—'}</b>
                  </span>
                </div>


                {myRole === 'seller' && (
                  <div className="messages-conv-system-text">
                    Kupujący zaakceptował cenę. Teraz czekasz na zakup („Kup teraz”) po stronie kupującego.
                  </div>
                )}

                {myRole === 'buyer' && (
                  <div className="messages-conv-system-actions">
                    <div className="messages-conv-system-text">
                      Sprzedający zaakceptował cenę. Teraz możesz kupić przedmiot.
                    </div>

                    <button
                      type="button"
                      className="messages-conv-buy-now"
                      onClick={handleBuyNowClick}
                      disabled={isPurchased}
                    >
                      {isPurchased ? 'Kupiono' : 'Kup teraz'}
                    </button>
                  </div>
                )}
              </div>
            )}


            {messages.length === 0 ? (
              <p className="messages-conv-info">Brak wiadomości w tej konwersacji – rozpocznij rozmowę poniżej.</p>
            ) : (
              messages.map((m) => {
                const mine = user && m.sender_id === user.id;

                const avatarRaw = m.sender_avatar_url;
                const avatarSrc = avatarRaw ? joinApiUrl(String(avatarRaw)) : null;

                return (
                  <div key={m.id} className={`messages-conv-msg-row ${mine ? 'mine' : 'theirs'}`}>
                    {!mine && (
                      <div className="messages-conv-msg-avatar">
                        {avatarSrc && (
                          <img
                            src={avatarSrc}
                            className="messages-conv-msg-avatar-img"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                      </div>
                    )}

                    <div className={`messages-conv-bubble ${mine ? 'mine' : 'theirs'}`}>
                      <div className="messages-conv-bubble-header">
                        <span className="messages-conv-author">{mine ? 'Ty' : m.sender_username}</span>

                        <span className="messages-conv-meta">
                          <span className="messages-conv-date">{formatDate(m.created_at)}</span>
                        </span>
                      </div>
                      {(() => {
                        const parsed = parseHelpApplyMessage(m.content);
                        if (parsed) return renderHelpApplyCard(m, parsed);
                        return <div className="messages-conv-text">{m.content}</div>;
                      })()}
                      {(m.attachment_url || (m as any).attachmentUrl) ? (
                        <div className="messages-conv-attachment">
                          {String(m.attachment_mime || (m as any).attachmentMime || '').startsWith('image/') ? (
                            <a
                              href={joinApiUrl(String(m.attachment_url || (m as any).attachmentUrl))}
                              target="_blank"
                              rel="noreferrer"
                              className="messages-conv-attachment-image-link"
                            >
                              <img
                                src={joinApiUrl(String(m.attachment_url || (m as any).attachmentUrl))}
                                alt={String(m.attachment_name || (m as any).attachmentName || 'Zdjęcie')}
                                className="messages-conv-attachment-image"
                                loading="lazy"
                                decoding="async"
                              />
                            </a>
                          ) : (
                            <a
                              href={joinApiUrl(String(m.attachment_url || (m as any).attachmentUrl))}
                              target="_blank"
                              rel="noreferrer"
                            >
                              📄 {String(m.attachment_name || (m as any).attachmentName || 'Załącznik.pdf')}
                            </a>
                          )}
                        </div>
                      ) : null}
                      {mine ? (() => {
                        const st = getMyMessageStatus(m);
                        return (
                          <span
                            className={`messages-conv-status-corner ${st.kind}`}
                            title={st.text}
                            aria-label={st.text}
                          >
                            {st.icon}
                          </span>
                        );
                      })() : null}
                    </div>

                    {mine && (
                      <div className="messages-conv-msg-avatar">
                        {avatarSrc && (
                          <img
                            src={avatarSrc}
                            className="messages-conv-msg-avatar-img"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        )}
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
              {remoteTyping ? `${peerName || 'Użytkownik'} pisze…` : isTyping ? 'Piszesz…' : '\u00A0'}
            </div>

            <textarea
              className="messages-conv-textarea"
              placeholder="Napisz odpowiedź..."
              value={content}
              onChange={(e) => handleTypingChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending && (content.trim() || attachmentFile)) sendMutation.mutate({ text: content, file: attachmentFile });
                }
              }}
              rows={3}
              disabled={sending}
            />

            <div className="messages-conv-attach-row">
              <input
                ref={fileInputRef}
                type="file"
                accept={listingInfo?.typeId === 3 ? 'application/pdf' : 'image/*'}
                onChange={(e) => handlePickAttachment(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                disabled={sending}
              />
              {attachmentFile ? (
                <button
                  type="button"
                  className="messages-conv-attach-clear"
                  onClick={() => {
                    setAttachmentFile(null);
                    setAttachmentError('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={sending}
                >
                  Usuń {listingInfo?.typeId === 3 ? 'PDF' : 'załącznik'}
                </button>
              ) : null}
            </div>

            {attachmentError ? <div className="messages-conv-attach-error">{attachmentError}</div> : null}

            {attachmentFile ? (
              <div className="messages-conv-attach-selected">📎 {attachmentFile.name}</div>
            ) : null}

            <button
              type="submit"
              className="messages-conv-submit"
              disabled={sending || (!content.trim() && !attachmentFile)}
            >
              {sending ? 'Wysyłanie...' : 'Wyślij'}
            </button>
          </form>
        </>
      )}

      {showPayment && (
        <div className="messages-conv-blik-backdrop" onClick={() => setShowPayment(false)}>
          <div className="messages-conv-blik-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Płatność BLIK</h2>
            <p>Wpisz 6-cyfrowy kod BLIK, aby kupić przedmiot.</p>

            <input
              type="text"
              maxLength={6}
              value={blikCode}
              onChange={(e) => setBlikCode(e.target.value.replace(/\D/g, ''))}
              className="messages-conv-blik-input"
              placeholder="••••••"
            />

            {blikError && <div className="messages-conv-blik-error">{blikError}</div>}

            <div className="messages-conv-blik-actions">
              <button type="button" onClick={() => setShowPayment(false)}>
                Anuluj
              </button>
              <button type="button" onClick={handleConfirmBlik} disabled={purchaseLoading}>
                {purchaseLoading ? 'Przetwarzanie…' : 'Zapłać BLIK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MessagesConversationPage;