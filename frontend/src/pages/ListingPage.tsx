import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ListingPage.css';
import { useAuth } from '../auth/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  if (typeId === 3) return '/icons/work-case-filled-svgrepo-com.svg';
  if (typeId === 2) return '/icons/hands-holding-heart-svgrepo-com.svg';
  return null;
};

const ListingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlType = params.get('type') as FilterType | null;

  const searchParamRaw = params.get('search');
  const searchParam = (searchParamRaw ?? '').trim().toLowerCase();

  const [typeFilter, setTypeFilter] = useState<FilterType>(
    urlType === 'work' || urlType === 'sales' || urlType === 'help' ? urlType : ''
  );
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<number | ''>('');
  const [helpTypeFilter, setHelpTypeFilter] = useState<'all' | 'offer' | 'need'>('all');

  const favoritesQueryKey = useMemo(() => ['listings', 'favorites'], []);

  const { data: favoriteIds = [] } = useQuery<number[], Error>({
    queryKey: favoritesQueryKey,
    enabled: !!user,
    staleTime: 20_000,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/listings/favorites`, {
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) return [];
      return data.map((it: any) => Number(it.id)).filter((x: any) => Number.isFinite(x));
    },
  });

  const toggleFavoriteMutation = useMutation<
    void,
    Error,
    { listingId: number; isCurrentlyFavorite: boolean }
  >({
    mutationFn: async ({ listingId, isCurrentlyFavorite }) => {
      if (!user) throw new Error('Brak sesji');
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
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Błąd zmiany ulubionych');
      }
    },
    onMutate: async ({ listingId, isCurrentlyFavorite }) => {
      await queryClient.cancelQueries({ queryKey: favoritesQueryKey });
      const prev = queryClient.getQueryData<number[]>(favoritesQueryKey) || [];
      const next = isCurrentlyFavorite ? prev.filter((id) => id !== listingId) : [...prev, listingId];
      queryClient.setQueryData<number[]>(favoritesQueryKey, next);
      return { prev } as any;
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData<number[]>(favoritesQueryKey, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
    },
  });

  const { data: allCategories = [] } = useQuery<Category[], Error>({
    queryKey: ['listings', 'categories'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/listings/categories`, {
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? (data as Category[]) : [];
    },
  });

  const categories = useMemo(() => {
    if (!typeFilter) return [];
    const map: Record<string, string> = { work: 'Praca', help: 'Pomoc', sales: 'Sprzedaż' };
    return allCategories.filter((c) => c.name === map[typeFilter]);
  }, [allCategories, typeFilter]);

  const effectiveCategoryId = categoryFilter || (categories.length ? categories[0].id : '');

  const { data: subcategories = [] } = useQuery<Subcategory[], Error>({
    queryKey: ['listings', 'subcategories', effectiveCategoryId],
    enabled: !!effectiveCategoryId,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/listings/subcategories?category_id=${effectiveCategoryId}`, {
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? (data as Subcategory[]) : [];
    },
  });

  const listingsQueryKey = useMemo(
    () => ['listings', 'list', { typeFilter, effectiveCategoryId, subcategoryFilter, helpTypeFilter, searchParam }],
    [typeFilter, effectiveCategoryId, subcategoryFilter, helpTypeFilter, searchParam]
  );

  const prefetchListingDetails = async (listingId: number) => {
    const idStr = String(listingId);

    await queryClient.prefetchQuery({
      queryKey: ['listing', idStr],
      staleTime: 15_000,
      queryFn: async () => {
        const res = await fetch(`${API_BASE}/api/listings/${idStr}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
          credentials: 'include',
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || `HTTP ${res.status}`);
        }
        return await res.json();
      },
    });
  };

  const { data: listings = [], isPending: loading } = useQuery<Listing[], Error>({
    queryKey: listingsQueryKey,
    staleTime: 15_000,
    queryFn: async () => {
      const q = new URLSearchParams();

      const mapTypeToCategoryName: Record<string, string> = {
        work: 'praca',
        help: 'pomoc',
        sales: 'sprzedaż',
      };
      if (typeFilter) q.set('category', mapTypeToCategoryName[typeFilter]);

      if (effectiveCategoryId) q.set('category_id', String(effectiveCategoryId));
      if (subcategoryFilter) q.set('subcategory_id', String(subcategoryFilter));

      if (typeFilter === 'help' && helpTypeFilter !== 'all') {
        q.set('help_type', helpTypeFilter);
      }

      const qs = q.toString();
      const url = qs ? `${API_BASE}/api/listings?${qs}` : `${API_BASE}/api/listings`;

      const res = await fetch(url, {
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => []);
      const filled: Listing[] = Array.isArray(data) ? data : [];

      if (!searchParam) return filled;

      return filled.filter((l: any) => {
        const title = (l.title ?? '').toLowerCase();
        const desc = (l.description ?? '').toLowerCase();
        const loc = (l.location ?? '').toLowerCase();
        return title.includes(searchParam) || desc.includes(searchParam) || loc.includes(searchParam);
      });
    },
  });

  const handleToggleFavorite = (
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

    if (!toggleFavoriteMutation.isPending) {
      toggleFavoriteMutation.mutate({ listingId, isCurrentlyFavorite });
    }
  };

  type InboxThread = {
    listing_id: number;
    unread_count: number; 
  };
  
  const { data: inboxThreads = [] } = useQuery<InboxThread[], Error>({
    queryKey: ['messages', 'inbox'],
    enabled: !!user,
    staleTime: 10_000,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/messages/inbox`, {
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
      const data = await res.json().catch(() => null);
  
      const threads = Array.isArray(data) ? data : data?.threads || data?.items || [];
      return threads.map((t: any) => ({
        listing_id: Number(t.listing_id ?? t.listingId),
        unread_count: Number(t.unread_count ?? t.unreadCount ?? 0),
      }));
    },
  });
  
  const unreadByListingId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const t of inboxThreads) {
      if (!Number.isFinite(t.listing_id)) continue;
      map[t.listing_id] = (map[t.listing_id] || 0) + (t.unread_count || 0);
    }
    return map;
  }, [inboxThreads]);
  

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
                setCategoryFilter('');
                setSubcategoryFilter('');
              }}
            >
              <option value="">Wszystkie typy</option>
              <option value="work">Praca</option>
              <option value="help">Pomoc</option>
              <option value="sales">Sprzedaż</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="subcategoryFilter">
              Podkategoria
            </label>
            <select
              id="subcategoryFilter"
              className="filter-select"
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(Number(e.target.value) || '')}
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
            <div className="filter-group">
              <label className="filter-label" htmlFor="helpTypeFilter">
                Rodzaj pomocy
              </label>
              <select
                id="helpTypeFilter"
                className="filter-select"
                value={helpTypeFilter}
                onChange={(e) => setHelpTypeFilter(e.target.value as 'all' | 'offer' | 'need')}
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
        <p style={{ textAlign: 'center', marginTop: '20px' }}>Ładowanie ogłoszeń...</p>
      ) : listings.length === 0 ? (
        <p>Brak ogłoszeń.</p>
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => {
            const isFav = favoriteIds.includes(listing.id);
            const isOwn = !!user && listing.user_id === user.id;
            const unreadCount = unreadByListingId[listing.id] || 0;
            const imgSrc =
              listing.primary_image
                ? listing.primary_image.startsWith('data:')
                  ? listing.primary_image
                  : `${API_BASE}${listing.primary_image}`
                : null;
            const authorAvatarSrc =
              listing.author_avatar_url
                ? listing.author_avatar_url.startsWith('data:')
                  ? listing.author_avatar_url
                  : `${API_BASE}${listing.author_avatar_url}`
                : null;

            return (
              <div
                key={listing.id}
                className="listing-card"
                onMouseEnter={() => prefetchListingDetails(listing.id)}
                onFocus={() => prefetchListingDetails(listing.id)}
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
                {!isOwn && (
                  <button
                    className={`favorite-toggle ${isFav ? 'favorite-toggle--active' : ''}`}
                    aria-label={isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                    onClick={(e) => handleToggleFavorite(e, listing.id, isFav)}
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
                )}


                {listing.is_featured && (
                  <div
                    className="featured-badge"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#FACC15">
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.173L12 18.896l-7.336 3.874 1.402-8.173L.132 9.21l8.2-1.192z" />
                    </svg>
                  </div>
                )}

                <div
                  className="listing-link"
                  aria-label={`Zobacz ogłoszenie: ${listing.title}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="listing-thumb-wrapper">
                    {imgSrc ? (
                      <img className="listing-thumb" src={imgSrc} alt={listing.title} />
                    ) : getDefaultIconForType(listing.type_id) ? (
                      <div className="listing-thumb-space">
                        <img
                          className="listing-thumb"
                          src={getDefaultIconForType(listing.type_id)!}
                          alt="Ikona ogłoszenia"
                          style={{ objectFit: 'contain', padding: '12px' }}
                        />
                      </div>
                    ) : (
                      <div className="listing-thumb-space">
                        <svg className="listing-thumb-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect x="4" y="4" width="16" height="16" rx="3" />
                          <path d="M9 9l6 6M15 9l-6 6" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <h3 className="listing-title">{listing.title}</h3>
                  <p className="listing-author">
                    <span className="mini-avatar" aria-hidden="true">
                      {authorAvatarSrc ? (
                        <img
                          src={authorAvatarSrc}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '50%',
                            display: 'block',
                          }}
                        />
                      ) : (
                        (listing.author_username || 'U')[0].toUpperCase()
                      )}
                    </span>
                    Autor: {listing.author_username ?? 'nieznany'}
                  </p>
                  <p className="listing-location">Lokalizacja: {listing.location}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ListingPage;