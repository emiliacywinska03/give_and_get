import React, {useState} from 'react';
import './Header.css'

const Header: React.FC = () => {
    return(
        <>
        <header>
            <div className="header-content">
                <div className="left">
                    <a href="/" className="logo">Give&Get</a>
                </div>
                <div className="right">
                    <div className="favourites">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12.01 6.001C6.5 1 1 8 5.782 13.001L12.011 20l6.23-7C23 8 17.5 1 12.01 6.002Z"/>
                        </svg>
                    </div>
                    <div className="messages">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17h6l3 3v-3h2V9h-2M4 4h11v8H9l-3 3v-3H4V4Z"/>
                        </svg>
                    </div>
                    <button className="button-theme-toogle">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5V3m0 18v-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M5 12H3m18 0h-2M7.05 16.95l-1.414 1.414M18.364 5.636 16.95 7.05M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/>
                        </svg>
                    </button>
                    <div className="search-bar">
                        <input type="text" placeholder="Szukaj..." />
                    </div>
                    <div className="my-account">
                        <a href="/account" className="account">Moje konto</a>
                    </div>
                </div>
            </div>
        </header>
        </>
    );
}

export default Header;