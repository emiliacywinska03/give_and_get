import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Breadcrumbs.css';

const Breadcrumbs: React.FC = () => {
  const location = useLocation() as any;
  const navigate = useNavigate();

  const { pathname, state } = location;

  // Na stronie głównej brak paska
  if (pathname === '/') return null;

  // Start: zawsze "Strona główna"
  const items: { label: string; to?: string }[] = [
    { label: 'Strona główna', to: '/' },
  ];

  // /listings, /listings?...
  if (pathname.startsWith('/listings') && !pathname.startsWith('/listing/')) {
    items.push({ label: 'Przeglądaj ogłoszenia' });
  }

  // /listing/:id – szczegóły ogłoszenia
  if (pathname.startsWith('/listing/')) {
    items.push({ label: 'Przeglądaj ogłoszenia', to: '/listings' });

    const categoryName = state?.categoryName;
    const subcategoryName = state?.subcategoryName;

    if (categoryName) {
      items.push({
        label: categoryName,
        to: `/listings?category=${encodeURIComponent(categoryName)}`,
      });
    }

    if (categoryName && subcategoryName) {
      items.push({
        label: subcategoryName,
        to: `/listings?category=${encodeURIComponent(
          categoryName
        )}&subcategory=${encodeURIComponent(subcategoryName)}`,
      });
    }

    items.push({ label: state?.listingTitle || 'Szczegóły ogłoszenia' });
  }

  // /profile
  if (pathname.startsWith('/profile')) {
    items.push({ label: 'Mój profil' });
  }

  // /favorites
  if (pathname.startsWith('/favorites')) {
    items.push({ label: 'Ulubione' });
  }

  // /messages — lista wszystkich rozmów
  if (pathname === '/messages') {
    items.push({ label: 'Wiadomości' });
  }

  // /messages/listing/:id — konkretna konwersacja
  if (pathname.startsWith('/messages/listing/')) {
    items.push({ label: 'Wiadomości', to: '/messages' });
    items.push({ label: 'Konwersacja' });
  }

  // /auth
  if (pathname.startsWith('/auth')) {
    items.push({ label: 'Logowanie / Rejestracja' });
  }

  return (
    <div className="breadcrumbs-bar">
      <button
        type="button"
        className="breadcrumbs-back"
        onClick={() => navigate(-1)}
      >
        ← Wróć
      </button>

      <nav className="breadcrumbs-trail" aria-label="Breadcrumb">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <span key={index}>
              {index > 0 && <span className="breadcrumbs-separator"> / </span>}
              {item.to && !isLast ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span className={isLast ? 'breadcrumbs-current' : undefined}>
                  {item.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
};

export default Breadcrumbs;
