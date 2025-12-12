import React, { useEffect, useState } from "react";
import './Main.css'
import { Link } from "react-router-dom";
import "../pages/ListingPage.css"; 

const API_BASE =
  (process.env.REACT_APP_API_URL || "http://localhost:5050").replace(/\/$/, "");
const API_KEY = process.env.REACT_APP_API_KEY;


interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  type_id?: number;
  primary_image?: string | null;
  is_featured?: boolean;
}

async function fetchFirstImageFor(listingId: number): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/listings/${listingId}/images`, {
      credentials: 'include',
    });
    if (!r.ok) return null;
    const imgs: any[] = await r.json();
    if (!imgs.length) return null;

    const first = imgs[0];
    return first.path || null;
  } catch {
    return null;
  }
}

const getDefaultIconForType = (typeId?: number) => {
  if (typeId === 3) return "/icons/work-case-filled-svgrepo-com.svg";
  if (typeId === 2) return "/icons/hands-holding-heart-svgrepo-com.svg";
  return null;
};

const resolveImgSrc = (primary?: string | null) => {
  if (!primary) return null;
  if (primary.startsWith("data:")) return primary;
  if (primary.startsWith("http")) return primary;
  return `${API_BASE}${primary}`;
};

const Main: React.FC = () => {
    const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
    const [loadingFeatured, setLoadingFeatured] = useState(true);

    // --- pobranie wszystkich wyróżnionych ogłoszeń  ---
    useEffect(() => {
      const run = async () => {
        try {
          // bierzemy zwykłą listę ogłoszeń (która na pewno ma primary_image)
          const res = await fetch(`${API_BASE}/api/listings?limit=50&page=1`, {
            headers: { ...(API_KEY ? { "x-api-key": API_KEY } : {}) },
          });

          if (!res.ok) {
            console.error(
              "Błąd odpowiedzi /listings:",
              res.status,
              res.statusText
            );
            setFeaturedListings([]);
            return;
          }

          const data = await res.json();
          if (!Array.isArray(data)) {
            console.error("Nieprawidłowy format danych z /listings", data);
            setFeaturedListings([]);
            return;
          }

          const onlyFeatured = data.filter((it: any) => it.is_featured);

          const normalized: Listing[] = await Promise.all(
            onlyFeatured.map(async (it: any) => {
              let primary =
                it.primary_image ??
                it.primaryImage ??
                it.image_url ??
                it.main_image ??
                null;

              if (!primary) {
                const first = await fetchFirstImageFor(it.id);
                primary = first;
              }

              return {
                id: it.id,
                title: it.title,
                description: it.description,
                location: it.location,
                type_id: it.type_id,
                is_featured: it.is_featured,
                primary_image: primary,
              } as Listing;
            })
          );

          setFeaturedListings(normalized);
        } catch (e) {
          console.error("Błąd pobierania wyróżnionych:", e);
          setFeaturedListings([]);
        } finally {
          setLoadingFeatured(false);
        }
      };

      run();
    }, []);


    return(
        <main>
            <section className="about">
                <div className="container about-content">
                    <h1 className="about-title">
                        Znajdź to co potrzebujesz, sprzedaj to czego nie potrzebujesz
                    </h1>
                    <p className="about-description">
                        Przeglądaj tysiące ogłoszeń w kategoriach: praca, sprzedaż i usługi.
                    </p>
                    <div className="about-buttons">
                         <Link to="/listings/create" className="button-add-listing">Dodaj ogłoszenie</Link>
                         <Link to="/listings" className="button-search-listings">Przeglądaj ogłoszenia</Link>
                    </div>
                </div>
            </section>

            <section className="categories">
                <h1 className="categories-title">Kategorie</h1>
                <p className="categories-description">
                    Przeglądaj ogłoszenia według kategorii, aby znaleźć dokładnie to czego szukasz.
                </p>
                <div className="category-grid">
                    <CategoryCard
                        svg={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={130} height={130}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
                            </svg>
                        }
                        title="Praca"
                        description="Znajdź pracę lub zatrudnij talenty"
                        to="/listings?type=work"
                    />
                    <CategoryCard
                        svg={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={130} height={130}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                            </svg>
                          }
                          title="Sprzedaż"
                          description="Kupuj i sprzedawaj przedmioty"
                          to="/listings?type=sales"
                    />
                    <CategoryCard
                        svg={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={130} height={130}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                        }
                        title="Pomoc"
                        description="Oferuj lub poszukuj pomocy"
                        to="/listings?type=help"
                    />
                </div>
            </section>

            <section className="featured-section">
                <h2 className="featured-title">Wyróżnione ogłoszenia</h2>
                <p className="featured-description">
                Najciekawsze oferty od wszystkich użytkowników Give&amp;Get.
                </p>

                {loadingFeatured ? (
                <p>Ładowanie…</p>
                ) : featuredListings.length === 0 ? (
                <p>Brak wyróżnionych ogłoszeń.</p>
                ) : (
                <div className="listing-grid">
                    {featuredListings.map((listing) => (
<div key={listing.id} className="listing-card">
  {listing.is_featured && (
    <div className="featured-badge" onClick={(e) => e.stopPropagation()}>
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
    className="listing-link"
    style={{ textDecoration: "none", color: "inherit" }}
  >
    <div className="listing-thumb-wrapper">
      {resolveImgSrc(listing.primary_image) ? (
        <img
          className="listing-thumb"
          src={resolveImgSrc(listing.primary_image)!}
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
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="3"
              ry="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7 7l10 10M17 7L7 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>

    <h3 className="listing-title">{listing.title}</h3>
    <p className="listing-location">Lokalizacja: {listing.location}</p>
  </Link>
</div>
                    ))}
                </div>
                )}
            </section>

            <section className="why-section">
              <h2 className="why-title">Dlaczego Give&Get?</h2>
              <p className="why-subtitle">
                Prościej, lokalnie i w jednym miejscu — ogłoszenia, praca i pomoc sąsiedzka.
              </p>

              <div className="why-grid">
  <div className="why-card">
    <div className="why-icon">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    </div>
    <h3 className="why-card-title">Bezpiecznie</h3>
    <p className="why-card-text">
      Konto użytkownika i stały dostęp do Twoich ogłoszeń w profilu.
    </p>
  </div>

  <div className="why-card">
    <div className="why-icon">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    </div>
    <h3 className="why-card-title">Szybko</h3>
    <p className="why-card-text">
      Wyszukuj i filtruj oferty po typie oraz podkategorii.
    </p>
  </div>

  <div className="why-card">
    <div className="why-icon">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    </div>
    <h3 className="why-card-title">Lokalnie</h3>
    <p className="why-card-text">
      Łatwiej znaleźć coś w okolicy — wystarczy lokalizacja w ogłoszeniu.
    </p>
  </div>
</div>
            </section>
            </main>
        );         
    
}

interface CategoryCardProps {
    svg: React.ReactNode;
    title: string;
    description: string;
    to: string;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
    svg,
    title,
    description,
    to,
  }) => (
    <div className="category-card">
      <div className="category-icon">{svg}</div>
      <h3 className="category-title">{title}</h3>
      <p className="category-description">{description}</p>
      <Link to={to} className="button button-outline">
        Przeglądaj {title}
      </Link>
    </div>
  );


export default Main;