import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import './ListingPage.css';
import { useAuth } from '../auth/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

async function fetchFirstImageFor(listingId: number): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
      credentials: 'include',
    });
    if (!r.ok) return null;
    const imgs: { id: number; dataUrl: string }[] = await r.json();
    return imgs.length ? imgs[0].dataUrl : null;
  } catch {
    return null;
  }
}

type Category = { id: number; name: string };
type Subcategory = { id: number; name: string };

interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  type_id: number;
  user_id: number;
  author_username?: string;
  primary_image?: string | null;
}

type FilterType = '' | 'work' | 'help' | 'sales';

const ListingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<number | ''>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [helpTypeFilter, setHelpTypeFilter] = useState<'all' | 'offer' | 'need'>('all');
  const [imageIndex, setImageIndex] = useState<Record<number, number>>({});
  const [listingImages, setListingImages] = useState<Record<number, string[]>>({});

  const params = new URLSearchParams(location.search);
  const urlType = params.get('type') as FilterType | null;

  const searchParamRaw = params.get('search');
  const searchParam = (searchParamRaw ?? '').trim().toLowerCase();

  const [typeFilter, setTypeFilter] = useState<FilterType>(
    urlType === 'work' || urlType === 'sales' || urlType === 'help'
      ? urlType
      : ''
  );

  const showPrev = (listingId: number) => {
    setImageIndex(prev => {
      const images = listingImages[listingId] || [];
      const current = prev[listingId] || 0;
      const next = current === 0 ? images.length - 1 : current - 1;
      return { ...prev, [listingId]: next };
    });
  };
  
  const showNext = (listingId: number) => {
    setImageIndex(prev => {
      const images = listingImages[listingId] || [];
      const current = prev[listingId] || 0;
      const next = current === images.length - 1 ? 0 : current + 1;
      return { ...prev, [listingId]: next };
    });
  };
  

  // Wczytanie ulubionych ogłoszeń (raz, po zalogowaniu)
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) {
        setFavoriteIds([]);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/listings/favorites`, {
          credentials: 'include',
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setFavoriteIds(data.map((it: any) => it.id));
        }
      } catch (e) {
        console.error('Błąd pobierania ulubionych:', e);
      }
    };
    fetchFavorites();
  }, [user]);




  // Pobieranie kategorii po zmianie typu
  useEffect(() => {
    const run = async () => {
      setCategories([]);
      setCategoryFilter('');
      setSubcategories([]);
      setSubcategoryFilter('');

      if (!typeFilter) return;

      const res = await fetch(`${API_BASE}/api/listings/categories`, {
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
      const all: Category[] = await res.json();

      const map: Record<string, string> = {
        work: 'Praca',
        help: 'Pomoc',
        sales: 'Sprzedaż',
      };
      const filtered = all.filter((c) => c.name === map[typeFilter]);

      setCategories(filtered);
      if (filtered.length) setCategoryFilter(filtered[0].id);
    };
    run().catch(console.error);
  }, [typeFilter]);

  // Pobieranie podkategorii po zmianie kategorii
  useEffect(() => {
    const run = async () => {
      setSubcategories([]);
      setSubcategoryFilter('');
      if (!categoryFilter) return;

      const res = await fetch(
        `${API_BASE}/api/listings/subcategories?category_id=${categoryFilter}`,
        {
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        }
      );
      const data: Subcategory[] = await res.json();
      setSubcategories(data);
    };
    run().catch(console.error);
  }, [categoryFilter]);

  // Pobieranie ogłoszeń na podstawie filtrów
  useEffect(() => {
    const q = new URLSearchParams();

    const mapTypeToCategoryName: Record<string, string> = {
      work: 'praca',
      help: 'pomoc',
      sales: 'sprzedaż',
    };
    if (typeFilter) q.set('category', mapTypeToCategoryName[typeFilter]);

    if (categoryFilter) q.set('category_id', String(categoryFilter));
    if (subcategoryFilter) q.set('subcategory_id', String(subcategoryFilter));

    if (typeFilter === 'help' && helpTypeFilter !== 'all') {
      q.set('help_type', helpTypeFilter); 
    }

    const qs = q.toString();
    const url = qs ? `${API_BASE}/api/listings?${qs}` : `${API_BASE}/api/listings`;

    fetch(url, {
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    })
      .then((res) => {
        if (!res.ok)
          return res.text().then((t) => {
            throw new Error(`HTTP ${res.status}: ${t}`);
          });
        return res.json();
      })
      .then(async (data) => {
        const filled = await Promise.all(
          data.map(async (it: any) => {
            if (it.primary_image) return it;
            const first = await fetchFirstImageFor(it.id);
            return { ...it, primary_image: first };
          })
        );
        // pobranie WSZYSTKICH zdjęć do karuzeli
        const imgsMap: Record<number, string[]> = {};

        for (const l of filled) {
          try {
            const res = await fetch(`${API_BASE}/api/listings/${l.id}/images`);
            if (res.ok) {
              const imgs = await res.json();
              imgsMap[l.id] = imgs.map((i: any) => i.dataUrl);
            } else {
              imgsMap[l.id] = l.primary_image ? [l.primary_image] : [];
            }
          } catch {
            imgsMap[l.id] = l.primary_image ? [l.primary_image] : [];
          }
        }

        setListingImages(imgsMap);

        // filtrowanie po tym, co wpisane w ?search=
        const filtered = searchParam
          ? filled.filter((l: any) => {
              const title = (l.title ?? '').toLowerCase();
              const desc  = (l.description ?? '').toLowerCase();
              const loc   = (l.location ?? '').toLowerCase();

              return (
                title.includes(searchParam) ||
                desc.includes(searchParam)  ||
                loc.includes(searchParam)
              );
            })
          : filled;

        setListings(filtered);
      })

      .catch((err) => console.error('Błąd przy pobieraniu ogłoszeń: ', err));
  }, [typeFilter, categoryFilter, subcategoryFilter, helpTypeFilter, location.search]);


  //Kliknięcie serduszka w kafelku
  const handleToggleFavorite = async (
    e: React.MouseEvent,
    listingId: number,
    isCurrentlyFavorite: boolean
  ) => {
    e.preventDefault(); 
    e.stopPropagation();


    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const method = isCurrentlyFavorite ? 'DELETE' : 'POST';
      const res = await fetch(`${API_BASE}/api/listings/favorites/${listingId}`, {

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

      setFavoriteIds((prev) =>
        isCurrentlyFavorite
          ? prev.filter((id) => id !== listingId)
          : [...prev, listingId]
      );
    } catch (err) {
      console.error('Błąd podczas zmiany ulubionych:', err);
    }
  };


  return (
    <div className="listing-page">
      <h2>
        {typeFilter === 'work'
          ? 'Ogłoszenia – Praca'
          : typeFilter === 'sales'
          ? 'Ogłoszenia – Sprzedaż'
          : typeFilter === 'help'
          ? 'Ogłoszenia – Pomoc'
          : 'Wszystkie ogłoszenia'}
      </h2>

      <div className="filters-bar">
        <label> Typ </label>
        <select
          value={typeFilter}
          onChange={(e) => {
            const v = e.target.value as FilterType;
            setTypeFilter(v);
            setHelpTypeFilter('all'); 
          }}
        >

          <option value="">Typ</option>
          <option value="work">Praca</option>
          <option value="help">Pomoc</option>
          <option value="sales">Sprzedaż</option>
        </select>


        <div className="filter">
          <label>Podkategoria</label>
          <select
            value={subcategoryFilter}
            onChange={(e) =>
              setSubcategoryFilter(Number(e.target.value) || '')
            }
          >
            <option value="">Wszystkie</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {typeFilter === 'help' && (
          <label>
            Rodzaj pomocy
            <select
              value={helpTypeFilter}
              onChange={(e) =>
                setHelpTypeFilter(e.target.value as 'all' | 'offer' | 'need')
              }
            >
              <option value="all">Wszystkie</option>
              <option value="offer">Oferuję pomoc</option>
              <option value="need">Szukam pomocy</option>
            </select>
          </label>
        )}

      </div>

      {listings.length === 0 ? (
        <p>Brak ogłoszeń.</p>
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => {
            const isFav = favoriteIds.includes(listing.id);
            return (
              <div
                key={listing.id}
                className="listing-card"
                onClick={() => navigate(`/listing/${listing.id}`)}
                style={{ cursor: 'pointer' }}
              >
                {/* ikona serduszka w rogu kafelka */}
                <button
                  className={`favorite-toggle ${
                    isFav ? 'favorite-toggle--active' : ''
                  }`}
                  aria-label={
                    isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'
                  }
                  onClick={(e) =>
                    handleToggleFavorite(e, listing.id, isFav)
                  }
                >
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
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

                <Link
                  to={`/listing/${listing.id}`}
                  className="listing-link"
                  aria-label={`Zobacz ogłoszenie: ${listing.title}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="listing-thumb-wrapper">
                    {listingImages[listing.id] && listingImages[listing.id].length > 0 ? (
                      <>
                        <img
                          className="listing-thumb"
                          src={listingImages[listing.id][ imageIndex[listing.id] ?? 0 ]}
                          alt={listing.title}
                        />

                        {listingImages[listing.id].length > 1 && (
                          <>
                            <button
                              className="thumb-arrow left"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showPrev(listing.id);
                              }}
                            >
                              ←
                            </button>

                            <button
                              className="thumb-arrow right"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showNext(listing.id);
                              }}
                            >
                              →
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="listing-thumb-space"></div>
                    )}
                  </div>


                  <h3 className="listing-title">{listing.title}</h3>
                  <p className="listing-author">
                    <span className="mini-avatar">
                      {(listing.author_username || 'U')[0].toUpperCase()}
                    </span>
                    Autor: {listing.author_username ?? 'nieznany'}
                  </p>
                  <p className="listing-location">
                    Lokalizacja: {listing.location}
                  </p>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ListingPage;