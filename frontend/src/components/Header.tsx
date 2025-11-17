import React , {useState, useEffect} from 'react';
import './Header.css';
import MobileSidebar from './MobileSidebar';
import './MobileSidebar.css';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const Header: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        setIsDarkMode(true);
    }
    }, []);

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

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return(
        <>
        <header>
            <div className="header-content">
                <div className="left">
                    <button className="menu-button" onClick={()=>setSidebarOpen(true)}>☰</button>
                    <a href="/" className="logo">Give&Get</a>
                </div>
                <div className="right">

                    {/* NAGRODY */}
                    <div
                        className="rewards"
                        onClick={() => navigate('/rewards')}
                        style={{ cursor: 'pointer' }}
                    >
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


                    {/* ULUBIONE */}
                    <div
                        className="favourites"
                        onClick={() => navigate('/favorites')}
                        style={{ cursor: 'pointer' }}
                    >
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M12.01 6.001C6.5 1 1 8 5.782 13.001L12.011 20l6.23-7C23 8 17.5 1 12.01 6.002Z"/>
                        </svg>
                    </div>

                    {/* WIADOMOŚCI */}
                    <div className="messages" style={{ cursor: 'pointer' }}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M9 17h6l3 3v-3h2V9h-2M4 4h11v8H9l-3 3v-3H4V4Z"/>
                        </svg>
                    </div>

                    {/* MOTYW */}
                    <button className="button-theme-toggle" onClick={toggleTheme} aria-label="Przełącz motyw">
                        {isDarkMode ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"/>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M12 5V3m0 18v-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M5 12H3m18 0h-2M7.05 16.95l-1.414 1.414M18.364 5.636 16.95 7.05M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/>
                            </svg>
                        )}
                    </button>

                    {/* WYSZUKIWARKA */}
                    <div className="search-bar">
                        <input type="text" placeholder="Szukaj..." />
                    </div>

                    {/* KONTO */}
                    <div className="my-account">
                        {user ? (
                            <>
                                <Link to="/profile" className="account">Mój profil</Link>
                                <button onClick={handleLogout} className="account logout-button" style={{ marginLeft: '10px' }}>
                                    Wyloguj
                                </button>
                            </>
                        ) : (
                            <Link to="/auth" className="account">Zaloguj</Link>
                        )}
                    </div>

                </div>

            </div>
        </header>
        <MobileSidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
        </>
    );
}

export default Header;