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
  

  const handlePickPdf = (file: File | null) => {
    setAttachmentError('');
    if (!file) {
      setAttachmentFile(null);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setAttachmentError('Możesz dodać tylko plik PDF.');
      setAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAttachmentError('Plik jest za duży (max 10 MB).');
      setAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAttachmentFile(file);
  };

  useEffect(() => {
    const st: any = (location as any)?.state;
    if (!st) return;

    const t = typeof st.prefillText === 'string' ? st.prefillText : '';
    const f = st.prefillAttachment instanceof File ? st.prefillAttachment : null;

    if (t) setContent(t);
    if (f) handlePickPdf(f);

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
                        <span className="messages-conv-date">{formatDate(m.created_at)}</span>
                      </div>
                      <div className="messages-conv-text">{m.content}</div>
                      {(m.attachment_url || (m as any).attachmentUrl) ? (
                        <div className="messages-conv-attachment">
                          <a
                            href={joinApiUrl(String(m.attachment_url || (m as any).attachmentUrl))}
                            target="_blank"
                            rel="noreferrer"
                          >
                            📄 {String(m.attachment_name || (m as any).attachmentName || 'Załącznik.pdf')}
                          </a>
                        </div>
                      ) : null}
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
                accept="application/pdf"
                onChange={(e) => handlePickPdf(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
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
                  Usuń PDF
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