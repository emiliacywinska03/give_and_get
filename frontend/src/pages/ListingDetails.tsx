import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './ListingDetails.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type ListingDetails = {
  id: number;
  title: string;
  description: string;
  location: string | null;
  created_at: string;
  user_id: number;
  author_username?: string;
  author_avatar_url?: string | null; 
  category_name?: string;
  subcategory_name?: string;
  images?: string[];
  help_type?: 'offer' | 'need' | null;
  type_id?: number;          
  price?: number | null;
  is_free?: boolean;
  negotiable?: boolean;
  status_id?: number | null;
};

type ListingImage = {
  id: number;
  src: string;
};

type UiImageItem =
  | { kind: 'existing'; id: number; src: string }
  | { kind: 'new'; tempId: string; src: string; file: File };

const HIDDEN_KEYS = new Set<string>([
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'type_id',
  'images',
  'primary_image',
  'author_id',
  'status',
  'deleted_at',
  '__v',
  'author_username',
  'author_avatar_url',
]);

const ALIASES: Record<string, string> = {
  category_id: '__hide',
  subcategory_id: '__hide',
  status: '__hide',
  status_id: '__hide',
  statusId: '__hide',
  primary_image: '__hide',
  author_avatar_url: '__hide',
  authorAvatarUrl: '__hide',
  categoryId: '__hide',
  subcategoryId: '__hide',

  is_featured: '__hide',
  isFeatured: '__hide',
  price_pln: 'price',
  priceValue: 'price',
  price_value: 'price',
  priceAmount: 'price',
  amount: 'price',
  amount_pln: 'price',
  cost: 'price',
  cost_pln: 'price',

  is_negotiable: 'negotiable',
  isNegotiable: 'negotiable',
  negotiation: 'negotiable',

  free: 'is_free',
  isFree: 'is_free',

  item_condition: 'condition',
  jobMode: 'work_mode',
  job_mode: 'work_mode',
  jobCategory: 'job_category',
  job_category: 'job_category',
};

const LABELS: Record<string, string> = {
  title: 'Tytuł',
  description: 'Opis',
  location: 'Lokalizacja',
  city: 'Miasto',
  district: 'Dzielnica',
  author_username: 'Autor',
  category_name: 'Kategoria',
  subcategory_name: 'Podkategoria',
  price: 'Cena',
  negotiable: 'Do negocjacji',
  is_free: 'Za darmo',
  condition: 'Stan',
  salary: 'Wynagrodzenie',
  salary_min: 'Wynagrodzenie od',
  salary_max: 'Wynagrodzenie do',
  employment_type: 'Forma zatrudnienia',
  work_mode: 'Tryb pracy',
  job_category: 'Kategoria stanowiska',
  requirements: 'Wymagania',
  responsibilities: 'Obowiązki',
  benefits: 'Benefity',
  help_type: 'Rodzaj pomocy',
  help_for_help: 'Pomoc za pomoc',
  contact_email: 'E-mail',
  contact_phone: 'Telefon',
  tags: 'Tagi',
};

const PREFERRED_ORDER = [
  'title',
  'category_name',
  'subcategory_name',
  'location',
  'city',
  'district',
  'price',
  'is_free',
  'negotiable',
  'condition',
  'salary',
  'salary_min',
  'salary_max',
  'employment_type',
  'work_mode',
  'job_category',
  'requirements',
  'responsibilities',
  'benefits',
  'help_type',
  'help_for_help',
  'contact_email',
  'contact_phone',
  'tags',
];


function isPlainObject(v: any) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function formatVal(key: string, val: any): string {
  if (val === null || val === undefined) return '—';
  if (key === 'help_type') {
    if (val === 'offer') return 'Oferuję pomoc';
    if (val === 'need') return 'Szukam pomocy';
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'Tak' : 'Nie';
  if (typeof val === 'number') {
    if (/(price|salary)/i.test(key)) {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
      }).format(val);
    }
    return String(val);
  }
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';
    if (/(price|salary)/i.test(key)) {
      const num = Number(
        trimmed.replace(/[^0-9.,-]/g, '').replace(',', '.'),
      );
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        return new Intl.NumberFormat('pl-PL', {
          style: 'currency',
          currency: 'PLN',
        }).format(num);
      }
    }
    return trimmed;
  }
  return JSON.stringify(val);
}

function collectPairs(details: any): { key: string; label: string; value: string }[] {
  const pairs: { key: string; label: string; value: string }[] = [];
  const pushField = (k: string, v: any) => {
    if (HIDDEN_KEYS.has(k)) return;

    if (
      v === null ||
      v === undefined ||
      (typeof v === 'string' && !v.trim()) ||
      (Array.isArray(v) && v.length === 0)
    ) {
      if (typeof v !== 'boolean') {
        return;
      }
    }

    const label = LABELS[k] ?? k.replace(/_/g, ' ');
    pairs.push({ key: k, label, value: formatVal(k, v) });
  };

  const rawFree =
    (details as any)?.is_free ??
    (details as any)?.isFree ??
    (details as any)?.free;

  const isFreeListing =
    typeof rawFree === 'string' ? rawFree === 'true' : Boolean(rawFree);

  Object.entries(details || {}).forEach(([origKey, v]) => {
    const mapped = ALIASES.hasOwnProperty(origKey) ? ALIASES[origKey] : origKey;
    if (mapped === '__hide') return;

    if (
      (mapped === 'help_type' || mapped === 'help_for_help') &&
      (v === null || v === undefined || v === '')
    ) {
      return;
    }

    if (mapped === 'is_free') {
      const boolVal = typeof v === 'string' ? v === 'true' : Boolean(v);
      if (!boolVal) {
        return;
      }
    }


    const k = mapped;

    if (
      [
        'title',
        'description',
        'location',
        'city',
        'district',
        'author_username',
        'category_name',
        'subcategory_name',
        'price',
        'negotiable',
        'is_free',
        'condition',
        'salary',
        'salary_min',
        'salary_max',
        'employment_type',
        'work_mode',
        'requirements',
        'responsibilities',
        'benefits',
        'help_type',
        'help_for_help',
        'contact_email',
        'contact_phone',
        'tags',
      ].includes(k) ||
      (!HIDDEN_KEYS.has(k) &&
        (typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean' ||
          Array.isArray(v)))
    ) {
      pushField(k, v);
    }
  });

  ['attributes', 'details', 'metadata', 'contact'].forEach((node) => {
    const obj = (details as any)?.[node];
    if (isPlainObject(obj)) {
      Object.entries(obj).forEach(([k, v]) => pushField(k, v));
    }
  });

  const dedup = new Map<string, { key: string; label: string; value: string }>();
  for (const p of pairs) if (!dedup.has(p.key)) dedup.set(p.key, p);
  const list = Array.from(dedup.values());

  list.sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a.key);
    const ib = PREFERRED_ORDER.indexOf(b.key);
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label, 'pl');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return list;
}

export default function ListingDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const fromProfile = (location.state as any)?.fromProfile || false;
  const startInEdit = (location.state as any)?.editMode || false;

  const [data, setData] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [uiImages, setUiImages] = useState<UiImageItem[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const [editMode, setEditMode] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editIsFree, setEditIsFree] = useState(false);
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [editHelpType, setEditHelpType] = useState<'offer' | 'need' | ''>('');
  // PRACA (work) edit fields
  const [editSalary, setEditSalary] = useState('');
  const [editWorkMode, setEditWorkMode] = useState('');
  const [editJobCategory, setEditJobCategory] = useState('');
  const [editRequirements, setEditRequirements] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);

  const [showPayment, setShowPayment] = useState(false);
  const [blikCode, setBlikCode] = useState('');
  const [blikError, setBlikError] = useState('');
  const [isPurchased, setIsPurchased] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const [actionError, setActionError] = useState('');

  const [showOfferPrice, setShowOfferPrice] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerError, setOfferError] = useState('');
  const [offerLoading, setOfferLoading] = useState(false);



  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
          credentials: 'include',
        });

        if (res.status === 404) {
          navigate('/listings');
          return;
        }
        if (!res.ok) throw new Error(await res.text());

        const details = await res.json();
        setData(details);

        const toSrc = (val: any): string | null => {
          if (!val) return null;
          if (typeof val === 'string') {
            if (val.startsWith('data:') || val.startsWith('http')) return val;
            return `${API_BASE}${val}`;
          }
          if (typeof val === 'object') {
            if (val.dataUrl) return val.dataUrl as string;
            if (val.url) {
              const u = val.url as string;
              return u.startsWith('http') || u.startsWith('data:')
                ? u
                : `${API_BASE}${u}`;
            }
            if (val.path) {
              const p = val.path as string;
              return p.startsWith('http') || p.startsWith('data:')
                ? p
                : `${API_BASE}${p}`;
            }
          }
          return null;
        };

        let imagesList: ListingImage[] = [];

        try {
          const ri = await fetch(`${API_BASE}/api/listings/${id}/images`, {
            headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
            credentials: 'include',
          });
          if (ri.ok) {
            const imgs = await ri.json();
            imagesList = Array.isArray(imgs)
              ? imgs
                  .map((it: any) => {
                    const src = toSrc(it.dataUrl || it.url || it.path || null);
                    if (!src) return null;
                    return { id: it.id, src };
                  })
                  .filter(
                    (x: ListingImage | null): x is ListingImage => Boolean(x),
                  )
              : [];
          }
        } catch (e) {
          console.error('Błąd pobierania zdjęć:', e);
        }

        if (!imagesList.length && Array.isArray(details?.images)) {
          imagesList = details.images
            .map((it: any, idx: number) => {
              const src = toSrc(it);
              if (!src) return null;
              return { id: idx, src };
            })
            .filter(
              (x: ListingImage | null): x is ListingImage => Boolean(x),
            );
        }

        setImages(imagesList);
        setUiImages(imagesList.map((img) => ({ kind: 'existing', id: img.id, src: img.src })));
        setOrderDirty(false);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  useEffect(() => {
    const checkFavorite = async () => {
      if (!user || !id) {
        setIsFavorite(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/listings/favorites`, {
          credentials: 'include',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          const found = data.some((it: any) => String(it.id) === String(id));
          setIsFavorite(found);
        }
      } catch (e) {
        console.error('Błąd sprawdzania ulubionych:', e);
      }
    };
    checkFavorite();
  }, [user, id]);

  const isSold = data?.status_id === 3;   
  const isOwnListing = user && data && user.id === data.user_id;
  const canEdit =
    !!user && !!data && user.id === data.user_id && !isSold;  

  const isSale = data?.type_id === 1;
  const isHelp = data?.type_id === 2;
  const isWork = data?.type_id === 3;

  const actionLabel = isWork ? 'Aplikuj' : isHelp ? 'Zgłoś się' : null;
  
  const infoPairs = collectPairs(data);
  const infoPairsWithoutPrice = infoPairs.filter(
  (p) =>
    p.key !== 'price' &&
    p.key !== 'title' &&
    p.key !== 'category_name' &&
    p.key !== 'subcategory_name' &&
    p.key !== 'description' &&
    p.key !== 'negotiable' &&
    p.key !== 'requirements'
);

  const pricePair = infoPairs.find((p) => p.key === 'price');
  const negotiablePair = infoPairs.find((p) => p.key === 'negotiable');
  const isNegotiable =
    negotiablePair && typeof negotiablePair.value === 'string'
      ? negotiablePair.value.toLowerCase().startsWith('t')
      : false;
  const requirementsPair = infoPairs.find((p) => p.key === 'requirements');

  useEffect(() => {
    if (data && canEdit) {
      setEditTitle(data.title || '');
      setEditDescription(data.description || '');
      setEditLocation(data.location || '');
      setEditHelpType((data.help_type as any) ?? '');
      setEditCondition(
        String((data as any)?.item_condition ?? (data as any)?.condition ?? '')
      );
      const isSale = (data as any)?.type_id === 1;
      if (isSale) {
        const rawIsFree = Boolean((data as any)?.is_free);
        const rawPrice = (data as any)?.price;
        setEditPrice(rawIsFree ? '' : (rawPrice === null || typeof rawPrice === 'undefined' ? '' : String(rawPrice)));
        setEditIsFree(rawIsFree);
        setEditNegotiable(Boolean((data as any)?.negotiable));
      } else {
        setEditPrice('');
        setEditIsFree(false);
        setEditNegotiable(false);
      }
      // --- PRACA (work) fields initialization ---
      const isWork = (data as any)?.type_id === 3;
      if (isWork) {
        const rawSalary = (data as any)?.salary;
        setEditSalary(
          rawSalary === null || typeof rawSalary === 'undefined' ? '' : String(rawSalary),
        );
        setEditWorkMode(
          String((data as any)?.work_mode ?? (data as any)?.jobMode ?? ''),
        );
        setEditJobCategory(String((data as any)?.job_category ?? ''));
        setEditRequirements(String((data as any)?.requirements ?? ''));
      } else {
        setEditSalary('');
        setEditWorkMode('');
        setEditJobCategory('');
        setEditRequirements('');
      }
      // ---
      if (startInEdit) {
        setEditMode(true);
      }
    }
  }, [data, canEdit, startInEdit]);

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSale) {
      e.target.value = '';
      return;
    }
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);

    setNewImages((prev) => [...prev, ...filesArray]);

    const newItems: UiImageItem[] = filesArray.map((file) => ({
      kind: 'new',
      tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      src: URL.createObjectURL(file),
      file,
    }));

    setUiImages((prev) => {
      const merged = [...prev, ...newItems];
      return merged;
    });

    setOrderDirty(true);


    e.target.value = '';
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}/images/${imageId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });

      if (!res.ok) {
        console.error('Błąd usuwania zdjęcia:', await res.text());
        return;
      }

      setImages((prev) => prev.filter((img) => img.id !== imageId));
      setUiImages((prev) => prev.filter((img) => !(img.kind === 'existing' && img.id === imageId)));
      setOrderDirty(true);
    } catch (e) {
      console.error('Błąd usuwania zdjęcia:', e);
    }
  };

  const removeNewImage = (tempId: string) => {
    setUiImages((prev) => prev.filter((it) => !(it.kind === 'new' && it.tempId === tempId)));
    setNewImages((prev) => prev.filter((f) => {
      return true;
    }));
    setOrderDirty(true);
  };

  const moveUiImage = (fromIndex: number, toIndex: number) => {
    setUiImages((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
    setOrderDirty(true);
  };

  

const handleSave = async () => {
  if (!id) return;

  const desiredExistingIds = uiImages
    .filter((it): it is { kind: 'existing'; id: number; src: string } => it.kind === 'existing')
    .map((it) => it.id);

  const desiredNewFiles = uiImages
    .filter((it): it is { kind: 'new'; tempId: string; src: string; file: File } => it.kind === 'new')
    .map((it) => it.file);

  const desiredSequence = uiImages.map((it) =>
    it.kind === 'existing'
      ? ({ kind: 'existing' as const, id: it.id })
      : ({ kind: 'new' as const })
  );

  try {
    const res = await fetch(`${API_BASE}/api/listings/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        location: editLocation,
        condition: editCondition,

        help_type: (data as any)?.type_id === 2 ? (editHelpType || null) : undefined,

        // SPRZEDAŻ
        price:
          (data as any)?.type_id === 1
            ? editIsFree
              ? 0
              : editPrice.trim() === ''
              ? null
              : Number(editPrice.replace(',', '.'))
            : undefined,
        isFree: (data as any)?.type_id === 1 ? editIsFree : undefined,
        negotiable: (data as any)?.type_id === 1 ? editNegotiable : undefined,

        // PRACA
        salary:
          (data as any)?.type_id === 3
            ? editSalary.trim() === ''
              ? null
              : Number(editSalary.replace(/[^0-9.,-]/g, '').replace(',', '.'))
            : undefined,
        work_mode: (data as any)?.type_id === 3 ? (editWorkMode || null) : undefined,
        job_category: (data as any)?.type_id === 3 ? (editJobCategory || null) : undefined,
        requirements: (data as any)?.type_id === 3 ? (editRequirements || '') : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(`Błąd zapisu: ${err?.error || res.statusText}`);
      return;
    }

    const body = await res.json();
    const updated = body.updated ?? body;
    setData(updated);

    if (isSale && desiredNewFiles.length > 0) {
      const formData = new FormData();
      desiredNewFiles.forEach((file) => formData.append('images', file));

      const imgRes = await fetch(`${API_BASE}/api/listings/${id}/images`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        body: formData,
      });

      if (!imgRes.ok) {
        console.error('Błąd zapisu zdjęć:', await imgRes.text());
      }
    }

    const toSrc = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'string') {
        if (val.startsWith('data:') || val.startsWith('http')) return val;
        return `${API_BASE}${val}`;
      }
      if (typeof val === 'object') {
        if (val.dataUrl) return val.dataUrl as string;
        if (val.url) {
          const u = val.url as string;
          return u.startsWith('http') || u.startsWith('data:') ? u : `${API_BASE}${u}`;
        }
        if (val.path) {
          const p = val.path as string;
          return p.startsWith('http') || p.startsWith('data:') ? p : `${API_BASE}${p}`;
        }
      }
      return null;
    };

    let normalized: ListingImage[] = [];
    try {
      const ri = await fetch(`${API_BASE}/api/listings/${id}/images`, {
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });

      if (ri.ok) {
        const imgs = await ri.json();
        normalized = Array.isArray(imgs)
          ? imgs
              .map((it: any) => {
                const src = toSrc(it.dataUrl || it.url || it.path || null);
                if (!src) return null;
                return { id: it.id, src };
              })
              .filter((x: ListingImage | null): x is ListingImage => Boolean(x))
          : [];
      }
    } catch (e) {
      console.error('Błąd odświeżania zdjęć:', e);
    }

    const fetchedIds = normalized.map((x) => x.id);
    const newFetchedIds = fetchedIds.filter((x) => !desiredExistingIds.includes(x));

    const finalOrderedIds: number[] = [];
    let newPtr = 0;

    for (const item of desiredSequence) {
      if (item.kind === 'existing') {
        finalOrderedIds.push(item.id);
      } else {
        const idForNew = newFetchedIds[newPtr++];
        if (typeof idForNew === 'number') finalOrderedIds.push(idForNew);
      }
    }


    if (isSale && finalOrderedIds.length > 0) {
      try {
        const ro = await fetch(`${API_BASE}/api/listings/${id}/images/reorder`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
          body: JSON.stringify({ orderedImageIds: finalOrderedIds }),
        });

        if (!ro.ok) {
          console.warn('Nie udało się zapisać kolejności zdjęć:', await ro.text());
        }
      } catch (e) {
        console.error('Błąd zapisu kolejności zdjęć:', e);
      }
    }

    setImages(normalized);
    setUiImages(normalized.map((img) => ({ kind: 'existing', id: img.id, src: img.src })));
    setOrderDirty(false);
    setNewImages([]);
    setEditMode(false);
    setEditCondition(((updated as any)?.condition ?? editCondition) as string);
    window.location.reload();
  } catch (e) {
    console.error('Błąd podczas zapisu ogłoszenia', e);
    alert('Wystąpił błąd podczas zapisywania ogłoszenia.');
  }
};

  const handleToggleFavorite = async () => {
    if (!user || !id) {
      navigate('/auth');
      return;
    }

    try {
      const method = isFavorite ? 'DELETE' : 'POST';
      const res = await fetch(`${API_BASE}/api/listings/favorites/${id}`, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      });

      if (!res.ok) {
        console.error('Błąd zmiany ulubionych:', await res.text());
        return;
      }

      setIsFavorite((prev) => !prev);
    } catch (e) {
      console.error('Błąd podczas zmiany ulubionych:', e);
    }
  };


  const handleBuyNowClick = () => {
    if (!user) {
      // niezalogowany kupujący – przekieruj do logowania
      navigate('/auth');
      return;
    }
    if (user.id === data?.user_id) {
      alert('Nie możesz kupić własnego ogłoszenia');
      return;
    }
    setShowPayment(true);
  };



  const handleOfferPriceClick = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (user.id === data?.user_id) {
      alert('Nie możesz zaproponować ceny dla własnego ogłoszenia');
      return;
    }
    setOfferError('');
    setOfferPrice('');
    setShowOfferPrice(true);
  };
  
  const handleSendOfferPrice = async () => {
    if (!data) return;
  
    const val = Number(offerPrice.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) {
      setOfferError('Wpisz poprawną kwotę.');
      return;
    }
  
    try {
      setOfferLoading(true);
      setOfferError('');
  
      // najprościej: wysyłamy jako wiadomość do autora (masz już endpoint apply)
      const content = `Cześć! Proponuję cenę ${new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
      }).format(val)} za "${data.title}".`;
  
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: JSON.stringify({
          listingId: data.id,
          content,
        }),
      });
  
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setOfferError(payload?.error || 'Nie udało się wysłać propozycji.');
        return;
      }
  
      setShowOfferPrice(false);
      navigate(`/messages/listing/${data.id}?peer=${data.user_id}`);
    } catch (e) {
      console.error(e);
      setOfferError('Wystąpił błąd podczas wysyłania propozycji.');
    } finally {
      setOfferLoading(false);
    }
  };
  



  const handleApplyClick = async () => {
    if (!data) return;
  
    if (!user) {
      navigate('/auth');
      return;
    }
  
    if (user.id === data.user_id) {
      alert('Nie możesz zgłosić się do własnego ogłoszenia.');
      return;
    }
  
    if (data.type_id === 1) return;
  
    setActionLoading(true);
    setActionError('');
  
    const content =
      data.type_id === 3
        ? `Aplikuję na Twoje ogłoszenie: "${data.title}".`
        : `Jestem chętny(a) w sprawie ogłoszenia: "${data.title}".`;
  
    try {
      const res = await fetch(`${API_BASE}/api/messages/apply`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: JSON.stringify({
          listingId: data.id,
          content,
        }),
      });
  
      const payload = await res.json().catch(() => null);
  
      if (!res.ok || !payload?.ok) {
        setActionError(payload?.error || 'Nie udało się wysłać zgłoszenia.');
        return;
      }
  
      setActionSent(true);
      navigate(`/messages/listing/${data.id}?peer=${data.user_id}`);
    } catch (e) {
      console.error(e);
      setActionError('Wystąpił błąd podczas wysyłania zgłoszenia.');
    } finally {
      setActionLoading(false);
    }
  };
  

  const handleConfirmBlik = async () => {
    if (!id) return;

    if (!/^\d{6}$/.test(blikCode)) {
      setBlikError('Kod BLIK musi mieć dokładnie 6 cyfr.');
      return;
    }

    try {
      setPurchaseLoading(true);
      setBlikError('');

      const res = await fetch(`${API_BASE}/api/listings/${id}/purchase`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: JSON.stringify({ blikCode }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setBlikError(err?.error || 'Błąd podczas symulacji płatności.');
        return;
      }

      // ustawiamy lokalnie status na "sprzedane" 
      setData((prev) =>
        prev ? { ...prev, status_id: 3 } : prev
      );
      setIsPurchased(true);
      setShowPayment(false);
      setBlikCode('');
      alert('Zakup udany');
      
    } catch (e) {
      console.error('Błąd płatności:', e);
      setBlikError('Wystąpił błąd podczas płatności.');
    } finally {
      setPurchaseLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="listing-details-container">
        <p>Ładowanie…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="listing-details-container">
        <p>Brak danych.</p>
      </div>
    );
  }

    const helpTypeLabel =
    data.help_type === 'offer'
      ? 'Oferuję pomoc'
      : data.help_type === 'need'
      ? 'Szukam pomocy'
      : null;

    const authorAvatarSrc = data.author_avatar_url
    ? data.author_avatar_url.startsWith('http') ||
      data.author_avatar_url.startsWith('data:')
      ? data.author_avatar_url
      : `${API_BASE}${data.author_avatar_url}`
    : null;

  return (
    <div className="listing-details-container">
      <div className="listing-details-header">
        <div className="listing-details-title-row">
          {!editMode ? (
            <h1 className="listing-details-title">{data.title}</h1>
          ) : (
            <input
              className="inline-edit-input inline-edit-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          )}

        {user && !isSold && !isOwnListing && (
          <button
            className={`favorite-toggle favorite-toggle-details ${
              isFavorite ? 'favorite-toggle--active' : ''
            }`}
            aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            onClick={handleToggleFavorite}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12.01 6.001C6.5 1 1 8 5.782 13.001L12.011 20l6.23-7C23 8 17.5 1 12.01 6.002Z"
              />
            </svg>
          </button>
        )}


        </div>



              <div className="listing-author-box">
        <div className="listing-author-left">
          <div className="listing-user-avatar">
            {authorAvatarSrc ? (
              <img
                src={authorAvatarSrc}
                alt={`Avatar użytkownika ${data.author_username ?? ''}`}
                className="listing-user-avatar-img"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="7" r="4" />
                <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
              </svg>
            )}
          </div>

          <div className="listing-author-info">
            <div className="listing-author-label">OGŁOSZENIE DODAŁ(A)</div>
            <div className="listing-author-name">{data.author_username}</div>
          </div>
        </div>

          {user ? (
            user.id === data.user_id ? (
              <span className="message-info-self">
                To jest Twoje ogłoszenie.
              </span>
            ) : (
              <button
                className="message-button-author"
                type="button"
                onClick={() =>
                  navigate(`/messages/listing/${data.id}?peer=${data.user_id}`)
                }
              >
                Napisz wiadomość
              </button>
            )
          ) : (
            <button
              className="message-button-author"
              type="button"
              onClick={() => navigate('/auth')}
            >
              Zaloguj się, aby napisać
            </button>
          )}
        </div>

        <p className="listing-details-meta">
          Dodano: {new Date(data.created_at).toLocaleString()}
        </p>
      </div>

      <div className="listing-details-card">
        {canEdit && (
        <div className="inline-edit-toolbar">
          {!editMode ? (
            <button
              type="button"
              className="edit-button inline-edit-button"
              onClick={() => setEditMode(true)}
            >
              <span className="inline-edit-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </span>
              <span className="inline-edit-text">Edytuj</span>
            </button>
          ) : (
            <div className="inline-edit-actions">
              <button
                type="button"
                className="action-button save-button"
                onClick={handleSave}
              >
                Zapisz zmiany
              </button>

              <button
                type="button"
                className="action-button cancel-button"
                onClick={() => {
                  setEditMode(false);
                  if (data) {
                    setEditTitle(data.title || '');
                    setEditDescription(data.description || '');
                    setEditLocation(data.location || '');
                    setEditCondition(((data as any).condition ?? '') as string);

                    // reset PRACA fields
                    const rawSalary = (data as any)?.salary;
                    setEditSalary(
                      rawSalary === null || typeof rawSalary === 'undefined'
                        ? ''
                        : String(rawSalary),
                    );
                    setEditWorkMode(
                      String((data as any)?.work_mode ?? (data as any)?.jobMode ?? ''),
                    );
                    setEditJobCategory(String((data as any)?.job_category ?? ''));
                    setEditRequirements(String((data as any)?.requirements ?? ''));
                  }
                  setUiImages(images.map((img) => ({ kind: 'existing', id: img.id, src: img.src })));
                  setOrderDirty(false);
                  setNewImages([]);
                }}
              >
                Anuluj
              </button>
            </div>
          )}
        </div>
      )}
      {isSale && (uiImages.length > 0 || (canEdit && editMode)) && (
      <div className="listing-details-gallery">
          {isSale && canEdit && editMode && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImagesChange}
                className="inline-file-input"
              />
              <button
                type="button"
                className="add-photo-tile"
                onClick={() => fileInputRef.current?.click()}
                title="Dodaj zdjęcia"
              >
                <span className="add-photo-plus">＋</span>
                <span className="add-photo-text">Dodaj zdjęcia</span>
              </button>
            </>
          )}
            {uiImages.map((img, i) => {
              const key = img.kind === 'existing' ? `ex-${img.id}` : `new-${img.tempId}`;
              const src = img.src;

              return (
                <div key={key} className="listing-details-thumb">
                  <img
                    src={src}
                    alt={`Zdjęcie ${i + 1}`}
                    className="listing-details-image"
                    onClick={() => {
                      setLightboxIndex(i);
                      setLightboxImage(src);
                      setLightboxOpen(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  />

                  {canEdit && editMode && (
                    <>
                      <button
                        type="button"
                        className="image-delete-x"
                        onClick={() =>
                          img.kind === 'existing'
                            ? handleDeleteImage(img.id)
                            : removeNewImage(img.tempId)
                        }
                        aria-label="Usuń zdjęcie"
                        title="Usuń zdjęcie"
                      >
                        ✕
                      </button>

                      <div className="image-actions">
                        <button
                          type="button"
                          className="image-move-btn"
                          onClick={() => moveUiImage(i, i - 1)}
                          disabled={i === 0}
                          title="Przesuń w lewo"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          className="image-move-btn"
                          onClick={() => moveUiImage(i, i + 1)}
                          disabled={i === uiImages.length - 1}
                          title="Przesuń w prawo"
                        >
                          ▶
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <section className="listing-section">
  <h3 className="listing-section-title">Szczegóły ogłoszenia</h3>
  <div className="listing-attributes">
   {infoPairsWithoutPrice.map(({ key, label, value }) => (
  <div key={key} className="listing-attribute">
    <span className="listing-attribute-label">{label}</span>

    {editMode && canEdit && key === 'location' ? (
      <input
        className="inline-edit-input"
        type="text"
        value={editLocation}
        onChange={(e) => setEditLocation(e.target.value)}
        placeholder="Wpisz lokalizację"
      />
    ) : editMode && canEdit && key === 'condition' ? (
      <input
        className="inline-edit-input"
        type="text"
        value={editCondition}
        onChange={(e) => setEditCondition(e.target.value)}
        placeholder="Np. Nowy / Bardzo dobry"
      />
    ) : editMode && canEdit && key === 'help_type' && isHelp ? (
  <div className="select-wrap">
    <select
      className="inline-edit-input"
      value={editHelpType}
      onChange={(e) => setEditHelpType(e.target.value as any)}
    >
      <option value="">— wybierz —</option>
      <option value="offer">Oferuję pomoc</option>
      <option value="need">Szukam pomocy</option>
    </select>
  </div>
    ) : editMode && canEdit && key === 'salary' && isWork ? (
      <input
        className="inline-edit-input"
        type="text"
        inputMode="decimal"
        value={editSalary}
        onChange={(e) => setEditSalary(e.target.value)}
        placeholder="Np. 4500"
      />
    ) : editMode && canEdit && key === 'work_mode' && isWork ? (
      <input
        className="inline-edit-input"
        type="text"
        value={editWorkMode}
        onChange={(e) => setEditWorkMode(e.target.value)}
        placeholder="Np. stacjonarna / zdalna / hybrydowa"
      />
    ) : editMode && canEdit && key === 'job_category' && isWork ? (
      <input
        className="inline-edit-input"
        type="text"
        value={editJobCategory}
        onChange={(e) => setEditJobCategory(e.target.value)}
        placeholder="Np. pracownik / budowlanka / IT"
      />
    ) : (
      <span className="listing-attribute-value">{value}</span>
    )}
  </div>
))}
  </div>
</section>

        {(data.description || (canEdit && editMode)) && (
  <section className="listing-section listing-section-description">
    <h3 className="listing-section-title">Opis ogłoszenia</h3>
    {!editMode ? (
      <p className="listing-description-text">{data.description}</p>
    ) : (
      <textarea
        className="inline-edit-textarea"
        value={editDescription}
        onChange={(e) => setEditDescription(e.target.value)}
        rows={8}
      />
    )}
  </section>
)}
        {(requirementsPair || (isWork && canEdit && editMode)) && (
          <section className="listing-section listing-section-description">
            <h3 className="listing-section-title">Wymagania</h3>

            {editMode && canEdit && isWork ? (
              <textarea
                className="inline-edit-textarea"
                value={editRequirements}
                onChange={(e) => setEditRequirements(e.target.value)}
                rows={8}
                placeholder="Wpisz wymagania – najlepiej każdą pozycję w nowej linii"
              />
            ) : (
              <ul className="listing-description-text listing-requirements-list">
                {String(requirementsPair?.value ?? '')
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0)
                  .map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {data.type_id === 1 && (
        <div className="listing-price-highlight listing-price-highlight--bottom">
          <span className="listing-price-label">
            {data.is_free
              ? 'Za darmo'
              : isNegotiable
              ? 'Cena do negocjacji'
              : 'Cena'}
          </span>

          {editMode && canEdit ? (
            <div className="price-edit">
              <input
                className="price-edit-input"
                type="text"
                inputMode="decimal"
                value={editIsFree ? '' : editPrice}
                onChange={(e) =>
                  setEditPrice(e.target.value.replace(/[^0-9.,-]/g, ''))
                }
                placeholder={editIsFree ? 'Darmowe' : 'Wpisz cenę'}
                disabled={editIsFree}
              />

              <label className="price-edit-check">
                <input
                  type="checkbox"
                  checked={editIsFree}
                  onChange={(e) => setEditIsFree(e.target.checked)}
                />
                Za darmo
              </label>

              <label className="price-edit-check">
                <input
                  type="checkbox"
                  checked={editNegotiable}
                  onChange={(e) => setEditNegotiable(e.target.checked)}
                  disabled={editIsFree}
                />
                Do negocjacji
              </label>
            </div>
          ) : (
            <span className="listing-price-value">
              {data.is_free ? formatVal('price', 0) : pricePair?.value ?? '—'}
            </span>
          )}

          {!isSold && !isPurchased && data.type_id === 1 && !data.is_free && !isOwnListing && (
            <div className="listing-actions-row">
              <button className="buy-now-button" type="button" onClick={handleBuyNowClick}>
                <span>Kup teraz</span>
              </button>

              <button className="offer-price-button" type="button" onClick={handleOfferPriceClick}>
                Zaproponuj cenę
              </button>
            </div>
          )}


          {(isSold || isPurchased) && (
            <span className="listing-purchased-label">SPRZEDANO</span>
          )}
        </div>
      )}

      {(data.type_id === 2 || data.type_id === 3) && (
        <div className="listing-price-highlight listing-price-highlight--bottom">
          <span className="listing-price-label">
            {data.type_id === 3 ? 'Ogłoszenie pracy' : 'Ogłoszenie pomocy'}
          </span>

          {!isOwnListing && (
            <button
              className="buy-now-button" 
              type="button"
              onClick={handleApplyClick}
              disabled={actionLoading}
            >
              <span>{actionLoading ? 'Wysyłanie…' : actionLabel}</span>
            </button>
          )}

          {actionError && (
            <div style={{ marginTop: 8, color: 'crimson', fontSize: 14 }}>
              {actionError}
            </div>
          )}

          {actionSent && !actionError && (
            <div style={{ marginTop: 8, color: 'green', fontSize: 14 }}>
              Wysłano!
            </div>
          )}
        </div>
      )}


{showPayment && (
        <div
          className="blik-modal-backdrop"
          onClick={() => setShowPayment(false)}
        >
          <div
            className="blik-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Płatność BLIK</h2>
            <p>Wpisz 6-cyfrowy kod BLIK, aby zakupić towar.</p>

            <input
              type="text"
              maxLength={6}
              value={blikCode}
              onChange={(e) =>
                setBlikCode(e.target.value.replace(/\D/g, ''))
              }
              className="blik-input"
              placeholder="••••••"
            />

            {blikError && (
              <div className="blik-error">{blikError}</div>
            )}

            <div className="blik-actions">
              <button
                type="button"
                onClick={() => setShowPayment(false)}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirmBlik}
                disabled={purchaseLoading}
              >
                {purchaseLoading ? 'Przetwarzanie…' : 'Zapłać BLIK'}
              </button>
            </div>
          </div>
        </div>
      )}



      {showOfferPrice && (
        <div className="blik-modal-backdrop" onClick={() => setShowOfferPrice(false)}>
          <div className="blik-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Zaproponuj cenę</h2>
            <p>Wpisz kwotę, a wyślemy ją jako wiadomość do autora.</p>

            <input
              type="text"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="blik-input"
              placeholder="np. 250"
            />

            {offerError && <div className="blik-error">{offerError}</div>}

            <div className="blik-actions">
              <button type="button" onClick={() => setShowOfferPrice(false)}>
                Anuluj
              </button>
              <button type="button" onClick={handleSendOfferPrice} disabled={offerLoading}>
                {offerLoading ? 'Wysyłanie…' : 'Wyślij propozycję'}
              </button>
            </div>
          </div>
        </div>
      )}





      {lightboxOpen && lightboxImage && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxOpen(false)}
        >
          {uiImages.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-left"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => {
                  if (!uiImages.length) return prev;
                  const next = prev === 0 ? uiImages.length - 1 : prev - 1;
                  setLightboxImage(uiImages[next].src);
                  return next;
                });
              }}
            >
              ‹
            </button>
          )}

          <img
            src={lightboxImage}
            alt="Podgląd"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />

          {uiImages.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-right"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => {
                  if (!uiImages.length) return prev;
                  const next = prev === uiImages.length - 1 ? 0 : prev + 1;
                  setLightboxImage(uiImages[next].src);
                  return next;
                });
              }}
            >
              ›
            </button>
          )}

          <button
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}