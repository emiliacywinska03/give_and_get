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

type ListingImage = {
  id: number;
  src: string;
};

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

    if (mapped === 'price' && isFreeListing) {
      return;
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

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const [editMode, setEditMode] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const [isFavorite, setIsFavorite] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);

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

  const canEdit = !!user && !!data && user.id === data.user_id;
  const infoPairs = collectPairs(data);
  const infoPairsWithoutPrice = infoPairs.filter((p) => p.key !== 'price');

  const pricePair = infoPairs.find((p) => p.key === 'price');

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

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setNewImages(filesArray);
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
    } catch (e) {
      console.error('Błąd usuwania zdjęcia:', e);
    }
  };

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

      if (newImages.length > 0) {
        const formData = new FormData();
        newImages.forEach((file) => {
          formData.append('images', file);
        });

        try {
          const imgRes = await fetch(`${API_BASE}/api/listings/${id}/images`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
            },
            body: formData,
          });

          if (!imgRes.ok) {
            console.error('Błąd zapisu zdjęć:', await imgRes.text());
          } else {
            try {
              const ri = await fetch(`${API_BASE}/api/listings/${id}/images`, {
                credentials: 'include',
                headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
              });
              if (ri.ok) {
                const imgs = await ri.json();

                const toSrc = (val: any): string | null => {
                  if (!val) return null;
                  if (typeof val === 'string') {
                    if (val.startsWith('data:') || val.startsWith('http'))
                      return val;
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

                const normalized: ListingImage[] = Array.isArray(imgs)
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

                setImages(normalized);
                setNewImages([]);
              }
            } catch (e) {
              console.error('Błąd odświeżania zdjęć:', e);
            }
          }
        } catch (e) {
          console.error('Błąd przy wysyłaniu zdjęć:', e);
        }
      }
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

  return (
    <div className="listing-details-container">
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
          <div className="listing-details-help-pill">{helpTypeLabel}</div>
        )}

        <div className="listing-author-box">
          <div className="listing-author-left">
            <div className="listing-user-avatar">
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
        {images.length > 0 && (
          <div className="listing-details-gallery">
            {images.map((img, i) => (
              <div key={img.id} className="listing-details-thumb">
                <img
                  src={img.src}
                  alt={`Zdjęcie ${i + 1}`}
                  className="listing-details-image"
                  onClick={() => {
                    setLightboxIndex(i);
                    setLightboxImage(img.src);
                    setLightboxOpen(true);
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {canEdit && editMode && (
                  <button
                    type="button"
                    className="image-delete-btn"
                    onClick={() => handleDeleteImage(img.id)}
                  >
                    Usuń
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <dl className="listing-details-dl">
          {infoPairsWithoutPrice.map(({ key, label, value }) => (
            <div key={key} className="listing-details-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {pricePair && (
        <div className="listing-price-highlight listing-price-highlight--bottom">
          <span className="listing-price-label">Cena</span>
          <span className="listing-price-value">{pricePair.value}</span>
        </div>
      )}

      {canEdit && (
        <div className="listing-details-edit-section">
          {!editMode ? (
            <button className="edit-button" onClick={() => setEditMode(true)}>
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

              <label>
                Zdjęcia
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImagesChange}
                />
              </label>

              <div className="edit-form-buttons">
                <button
                  className="action-button save-button"
                  onClick={handleSave}
                >
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

      {lightboxOpen && lightboxImage && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxOpen(false)}
        >
          {images.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-left"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => {
                  if (!images.length) return prev;
                  const next = prev === 0 ? images.length - 1 : prev - 1;
                  setLightboxImage(images[next].src);
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

          {images.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-right"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => {
                  if (!images.length) return prev;
                  const next =
                    prev === images.length - 1 ? 0 : prev + 1;
                  setLightboxImage(images[next].src);
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