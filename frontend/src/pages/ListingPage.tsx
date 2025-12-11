import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import './ListingPage.css';
import { useAuth } from '../auth/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;



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
  author_avatar_url?: string | null;
  primary_image?: string | null;
  is_featured?: boolean;
  category_name?: string;
  subcategory_name?: string;
}

type FilterType = '' | 'work' | 'help' | 'sales';

const getDefaultIconForType = (typeId?: number) => {
  if (typeId === 3) {
    // PRACA
    return "/icons/work-case-filled-svgrepo-com.svg";
  }
  if (typeId === 2) {
    // POMOC
    return "/icons/hands-holding-heart-svgrepo-com.svg";
  }
  return null;
};


const ListingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<number | ''>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [helpTypeFilter, setHelpTypeFilter] = useState<'all' | 'offer' | 'need'>('all');

  const params = new URLSearchParams(location.search);
  const urlType = params.get('type') as FilterType | null;

  const searchParamRaw = params.get('search');
  const searchParam = (searchParamRaw ?? '').trim().toLowerCase();

  const [typeFilter, setTypeFilter] = useState<FilterType>(
    urlType === 'work' || urlType === 'sales' || urlType === 'help'
      ? urlType
      : ''
  );


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
    setLoading(true);
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
      .then((data) => {
        const filled: Listing[] = data;

        const filtered = searchParam
          ? filled.filter((l: any) => {
              const title = (l.title ?? '').toLowerCase();
              const desc = (l.description ?? '').toLowerCase();
              const loc = (l.location ?? '').toLowerCase();

              return (
                title.includes(searchParam) ||
                desc.includes(searchParam) ||
                loc.includes(searchParam)
              );
            })
          : filled;

        setListings(filtered);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Błąd przy pobieraniu ogłoszeń: ', err);
        setLoading(false);
      });
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

      <div className="filters-shell">
        <div className="filters-bar">
          {/* Typ ogłoszenia */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="typeFilter">
              Typ
            </label>
            <select
              id="typeFilter"
              className="filter-select"
              value={typeFilter}
              onChange={(e) => {
                const v = e.target.value as FilterType;
                setTypeFilter(v);
                setHelpTypeFilter('all');
              }}
            >
              <option value="">Wszystkie typy</option>
              <option value="work">Praca</option>
              <option value="help">Pomoc</option>
              <option value="sales">Sprzedaż</option>
            </select>
          </div>

          {/* Podkategoria */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="subcategoryFilter">
              Podkategoria
            </label>
            <select
              id="subcategoryFilter"
              className="filter-select"
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

          {/* Rodzaj pomocy – tylko dla typu „Pomoc” */}
          {typeFilter === 'help' && (
            <div className="filter-group">
              <label className="filter-label" htmlFor="helpTypeFilter">
                Rodzaj pomocy
              </label>
              <select
                id="helpTypeFilter"
                className="filter-select"
                value={helpTypeFilter}
                onChange={(e) =>
                  setHelpTypeFilter(e.target.value as 'all' | 'offer' | 'need')
                }
              >
                <option value="all">Wszystkie</option>
                <option value="offer">Oferuję pomoc</option>
                <option value="need">Szukam pomocy</option>
              </select>
            </div>
          )}
        </div>
      </div>


      {loading ? (
      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        Ładowanie ogłoszeń...
      </p>
    ) : listings.length === 0 ? (
      <p>Brak ogłoszeń.</p>
    ) : (
        <div className="listing-grid">
          {listings.map((listing) => {
            const isFav = favoriteIds.includes(listing.id);
            const imgSrc =
              listing.primary_image
                ? listing.primary_image.startsWith('data:')
                  ? listing.primary_image
                  : `${API_BASE}${listing.primary_image}`
                : null;

            const authorAvatarSrc = listing.author_avatar_url
              ? listing.author_avatar_url.startsWith('http') ||
                listing.author_avatar_url.startsWith('data:')
                ? listing.author_avatar_url
                : `${API_BASE}${listing.author_avatar_url}`
              : null;

            return (
              <div
                key={listing.id}
                className="listing-card"
                onClick={() =>
                  navigate(`/listing/${listing.id}`, {
                    state: {
                      listingTitle: listing.title,
                      categoryName: listing.category_name,
                      subcategoryName: listing.subcategory_name,
                    },
                  })
                }
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

                  {/* znaczek WYRÓŻNIONE */}
                  {listing.is_featured && (
                    <div
                      className="featured-badge"
                      onClick={(e) => {
                        e.stopPropagation();   
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="#FACC15"     
                      >
                        <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.173L12 18.896l-7.336 3.874 1.402-8.173L.132 9.21l8.2-1.192z" />
                      </svg>
                    </div>
                  )}

                <Link
                  to={`/listing/${listing.id}`}
                  state={{
                    listingTitle: listing.title,
                    categoryName: listing.category_name,
                    subcategoryName: listing.subcategory_name,
                  }}
                  className="listing-link"
                  aria-label={`Zobacz ogłoszenie: ${listing.title}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="listing-thumb-wrapper">
                  {imgSrc ? (
                    <img
                      className="listing-thumb"
                      src={imgSrc}
                      alt={listing.title}
                    />
                  ) : getDefaultIconForType(listing.type_id) ? (
                    <div className="listing-thumb-space">
                      <img
                        className="listing-thumb"
                        src={getDefaultIconForType(listing.type_id)!}
                        alt="Ikona ogłoszenia"
                        style={{ objectFit: "contain", padding: "12px" }}
                      />
                    </div>
                  ) : (
                    <div className="listing-thumb-space">
                      <svg
                        className="listing-thumb-placeholder-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="3" />
                        <path d="M9 9l6 6M15 9l-6 6" />
                      </svg>
                    </div>
                  )}
                </div>


                  <h3 className="listing-title">{listing.title}</h3>
                  <p className="listing-author">
                    <span className="mini-avatar">
                      {authorAvatarSrc ? (
                        <img
                          src={authorAvatarSrc}
                          alt={`Avatar użytkownika ${listing.author_username ?? ''}`}
                          className="mini-avatar-img"
                        />
                      ) : (
                        (listing.author_username || 'U')[0].toUpperCase()
                      )}
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