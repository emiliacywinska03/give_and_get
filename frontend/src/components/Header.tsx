import React, { useState, useEffect } from 'react';
import './Header.css';
import MobileSidebar from './MobileSidebar';
import './MobileSidebar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { io } from 'socket.io-client';


const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace(/\/$/, '');
const API_KEY = process.env.REACT_APP_API_KEY;

const Header: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();

  const [search, setSearch] = useState('');
  const [allTitles, setAllTitles] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get('search') ?? '');
  }, [location.search]);

  useEffect(() => {
    const fetchTitles = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings`, {
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
        });
        if (!res.ok) return;
        const data = await res.json();
        setAllTitles(data.map((l: any) => l.title as string));
      } catch (e) {
        console.error('Błąd pobierania tytułów do podpowiedzi', e);
      }
    };
    fetchTitles();
  }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      return;
    }

    const uniq = Array.from(new Set(allTitles));
    const filtered = uniq
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 5);

    setSuggestions(filtered);
  }, [search, allTitles]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
  
    let alive = true;
  
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/unread-count`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
        });
  
        const data = await res.json().catch(() => null);
  
        if (!alive) return;
        if (res.ok && data?.ok && typeof data.count === 'number') {
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error('Błąd pobierania liczby nieprzeczytanych wiadomości:', err);
      }
    };
  
    fetchUnread();
  
    const interval = window.setInterval(fetchUnread, 15000);
  
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [user]);
  
  useEffect(() => {
    if (!user) return;
  
    const socket = io(API_BASE, {
      withCredentials: true,
      transports: ['websocket'],
      upgrade: false,
      timeout: 10000,
      reconnectionAttempts: 5,
    });
  
    socket.on('connect', () => {
      socket.emit('auth:join', user.id);
    });
  
    const refreshUnread = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/unread-count`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && typeof data.count === 'number') {
          setUnreadCount(data.count);
        }
      } catch {}
    };
  
    socket.on('chat:new-message', refreshUnread);
    socket.on('chat:read', refreshUnread);
    socket.on('chat:unread-bump', refreshUnread);
  
    return () => {
      socket.disconnect();
    };
  }, [user]);
  

  const submitSearch = (value: string) => {
    const trimmed = value.trim();
    const params = new URLSearchParams(location.search);

    if (trimmed) {
      params.set('search', trimmed);
    } else {
      params.delete('search');
    }

    navigate({
      pathname: '/listings',
      search: params.toString(),
    });

    setShowSuggestions(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch(search);
  };

  const handleSuggestionClick = (s: string) => {
    setSearch(s);
    submitSearch(s);
  };

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);

    if (newTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    localStorage.setItem('theme', newTheme);
  };

  const handleLogout = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    await logout();
    navigate('/auth', { replace: true });
  };

  return (
    <>
      <header>
        <div className="header-content">
          <div className="left">
            <button className="menu-button" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <a href="/" className="logo">
              Give&Get
            </a>
          </div>

          <div className="right">
            <div className="header-icons">
              <div className="icon-btn rewards" onClick={() => navigate('/rewards')}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="8" width="18" height="13" rx="2" ry="2"></rect>
                  <path d="M12 8v13"></path>
                  <path d="M3 8h18"></path>
                  <path d="M12 8c-1 0-5-1.5-5-4a2 2 0 114 0"></path>
                  <path d="M12 8c1 0 5-1.5 5-4a2 2 0 10-4 0"></path>
                </svg>
              </div>

              <div className="icon-btn favourites" onClick={() => navigate('/favorites')}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12.01 6.001C6.5 1 1 8 5.782 13.001L12.011 20l6.23-7C23 8 17.5 1 12.01 6.002Z"
                  />
                </svg>
              </div>

              <div className="icon-btn featured-nav" onClick={() => navigate('/featured')}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2.5l2.9 5.88 6.5.95-4.7 4.58 1.1 6.47L12 17.7l-5.8 3.05 1.1-6.47-4.7-4.58 6.5-.95L12 2.5z" />
                </svg>
              </div>

              <div className="icon-btn messages" onClick={() => navigate('/messages')}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 17h6l3 3v-3h2V9h-2M4 4h11v8H9l-3 3v-3H4V4Z"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="icon-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </div>

              <div className="icon-btn history" onClick={() => navigate('/history')} title="Historia ogłoszeń">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v6l4 2" />
                </svg>
              </div>

              <button className="button-theme-toggle" onClick={toggleTheme} aria-label="Przełącz motyw">
                {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
                    />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 5V3m0 18v-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M5 12H3m18 0h-2M7.05 16.95l-1.414 1.414M18.364 5.636 16.95 7.05M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                    />
                  </svg>
                )}
              </button>
            </div>

            <form className="search-bar" onSubmit={handleSearchSubmit} autoComplete="off">
              <input
                type="text"
                placeholder="Szukaj..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />

              {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="search-suggestion-item"
                      onClick={() => handleSuggestionClick(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </form>

            {user && !sidebarOpen && (
              <button type="button" className="add-listing-header-btn" onClick={() => navigate('/listings/create')}>
                Dodaj ogłoszenie
              </button>
            )}

            <div className="my-account">
              {user ? (
                !sidebarOpen && (
                  <div className="account-dropdown">
                    <Link to="/profile" className="account-trigger">
                      Mój profil
                    </Link>

                    <div className="account-menu">
                      <button onClick={() => navigate('/profile')}>Profil</button>
                      <button onClick={() => navigate('/favorites')}>Moje ulubione</button>
                      <button onClick={() => navigate('/featured')}>Moje wyróżnione</button>
                      <button onClick={() => navigate('/rewards')}>Nagrody</button>
                      <button onClick={() => navigate('/history')}>Historia ogłoszeń</button>
                      <button onClick={() => navigate('/messages')}>Wiadomości</button>

                      <div className="menu-divider" />

                      <button
                    type="button"
                    className="dropdown-item logout"
                    onClick={async () => {
                      await logout();
                      navigate('/auth', { replace: true });
                    }}
                  >
                    Wyloguj
                  </button>
                    </div>
                  </div>
                )
              ) : (
                <Link to="/auth" className="account">
                  Zaloguj
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
};

export default Header;