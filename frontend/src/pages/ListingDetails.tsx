import React, { useEffect, useState } from 'react';
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
  category_name?: string;
  subcategory_name?: string;
  images?: string[];
  help_type?: 'offer' | 'need' | null;
};

const HIDDEN_KEYS = new Set<string>([
  'id','user_id','created_at','updated_at','type_id','images','primary_image',
  'author_id','status','deleted_at','__v'
]);

const ALIASES: Record<string, string> = {
  category_id: '__hide',
  subcategory_id: '__hide',
  status: '__hide',
  status_id: '__hide',
  statusId: '__hide',
  primary_image: '__hide',
  categoryId: '__hide',
  subcategoryId: '__hide',

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
};

const LABELS: Record<string,string> = {
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
  'title','category_name','subcategory_name','location','city','district',
  'price','is_free','negotiable','condition',
  'salary','salary_min','salary_max','employment_type','work_mode',
  'requirements','responsibilities','benefits',
  'help_type','help_for_help',
  'contact_email','contact_phone','tags'
];

function isPlainObject(v: any) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function formatVal(key: string, val: any): string {
  if (val === null || val === undefined) return '—';
  if (key === 'help_type') {
    if (val === 'offer') return 'Oferuję pomoc';
    if (val === 'need')  return 'Szukam pomocy';
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'Tak' : 'Nie';
  if (typeof val === 'number') {
    if (/(price|salary)/i.test(key)) {
      return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(val);
    }
    return String(val);
  }
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';
    if (/(price|salary)/i.test(key)) {
      const num = Number(trimmed.replace(/[^0-9.,-]/g, '').replace(',', '.'));
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(num);
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
    const label = LABELS[k] ?? k.replace(/_/g,' ');
    pairs.push({ key: k, label, value: formatVal(k, v) });
  };

  Object.entries(details || {}).forEach(([origKey, v]) => {
    const mapped = ALIASES.hasOwnProperty(origKey) ? ALIASES[origKey] : origKey;
    if (mapped === '__hide') return;
    const k = mapped;
    if ([
          'title','description','location','city','district','author_username','category_name','subcategory_name',
          'price','negotiable','is_free','condition','salary','salary_min','salary_max','employment_type','work_mode',
          'requirements','responsibilities','benefits','help_type','help_for_help','contact_email','contact_phone','tags'
        ].includes(k) || (!HIDDEN_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || Array.isArray(v)))) {
      pushField(k, v);
    }
  });

  ['attributes','details','metadata','contact'].forEach((node) => {
    const obj = (details as any)?.[node];
    if (isPlainObject(obj)) {
      Object.entries(obj).forEach(([k,v]) => pushField(k, v));
    }
  });

  const dedup = new Map<string, { key:string; label:string; value:string }>();
  for (const p of pairs) if (!dedup.has(p.key)) dedup.set(p.key, p);
  const list = Array.from(dedup.values());

  list.sort((a,b) => {
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
  const [images, setImages] = useState<string[]>([]);

  // stan edycji
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {})
          },
          credentials: 'include',
        });
        if (res.status === 404) { navigate('/listings'); return; }
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
              return u.startsWith('http') || u.startsWith('data:') ? u : `${API_BASE}${u}`;
            }
            if (val.path) {
              const p = val.path as string;
              return p.startsWith('http') || p.startsWith('data:') ? p : `${API_BASE}${p}`;
            }
          }
          return null;
        };

        let payloadImages: string[] = [];
        if (Array.isArray(details?.images)) {
          payloadImages = details.images
            .map((it: any) => toSrc(it))
            .filter((x: string | null): x is string => Boolean(x));
        }

        if (!payloadImages.length) {
          try {
            const ri = await fetch(`${API_BASE}/api/listings/${id}/images`, {
              headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
              credentials: 'include',
            });
            if (ri.ok) {
              const imgs = await ri.json();
              const normalized = Array.isArray(imgs)
                ? imgs
                    .map((it: any) => toSrc(it) || toSrc(it?.dataUrl) || toSrc(it?.url) || toSrc(it?.path))
                    .filter((x: string | null): x is string => Boolean(x))
                : [];
              payloadImages = normalized;
            }
          } catch (e) {
          
          }
        }

        setImages(payloadImages);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  
  // sprawdzenie czy to ogłoszenie jest w ulubionych
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


  const canEdit = !!user && !!data && user.id === data.user_id;
  const infoPairs = collectPairs(data);


  // kiedy wczytamy dane i mamy prawo edycji – ustaw wartości formularza
  useEffect(() => {
    if (data && canEdit) {
      setEditTitle(data.title || '');
      setEditDescription(data.description || '');
      setEditLocation(data.location || '');
      if (startInEdit) {
        setEditMode(true);
      }
    }
  }, [data, canEdit, startInEdit]);

  const handleSave = async () => {
    if (!id) return;
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
      setEditMode(false);
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


  if (loading) return <div className="listing-details-container"><p>Ładowanie…</p></div>;
  if (!data)    return <div className="listing-details-container"><p>Brak danych.</p></div>;

  const backTarget = fromProfile ? '/profile' : '/listings';

  const helpTypeLabel =
  data.help_type === 'offer'
    ? 'Oferuję pomoc'
    : data.help_type === 'need'
    ? 'Szukam pomocy'
    : null;


  return (
    <div className="listing-details-container">
      {/* nagłówek z tytułem + serce */}
      <div className="listing-details-header">
        <div className="listing-details-title-row">
          <h1 className="listing-details-title">{data.title}</h1>

          {user && (
            <button
              className={`favorite-toggle favorite-toggle-details ${
                isFavorite ? 'favorite-toggle--active' : ''
              }`}
              aria-label={
                isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'
              }
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

        {helpTypeLabel && (
          <div className="listing-details-help-pill">
            {helpTypeLabel}
          </div>
        )}

        <p className="listing-details-meta">
          Autor: <strong>{data.author_username ?? 'nieznany'}</strong> •{' '}
          Dodano: {new Date(data.created_at).toLocaleString()}
        </p>
      </div>


      <div className="listing-details-card">
        {images.length > 0 && (
          <div className="listing-details-gallery">
            {images.map((src, i) => (
              <img key={i} src={src} alt={`Zdjęcie ${i + 1}`} className="listing-details-image" />
            ))}
          </div>
        )}

        <dl className="listing-details-dl">
          {infoPairs.map(({ key, label, value }) => (
            <div key={key} className="listing-details-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {canEdit && (
        <div className="listing-details-edit-section">
          {!editMode ? (
            <button
              className="edit-button"
              onClick={() => setEditMode(true)}
            >
              Edytuj ogłoszenie
            </button>
          ) : (
            <div className="edit-form">
              <h2>Edytuj ogłoszenie</h2>
              <label>
                Tytuł
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </label>

              <label>
                Opis
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={5}
                />
              </label>

              <label>
                Lokalizacja
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </label>

              <div className="edit-form-buttons">
                <button className="action-button save-button" onClick={handleSave}>
                  Zapisz
                </button>
                <button
                  className="action-button cancel-button"
                  onClick={() => {
                    setEditMode(false);
                    if (data) {
                      setEditTitle(data.title || '');
                      setEditDescription(data.description || '');
                      setEditLocation(data.location || '');
                    }
                  }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}