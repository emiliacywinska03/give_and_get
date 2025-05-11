import React from "react";
import './MobileSidebar.css'

interface MobileSidebarProps{
    open: boolean;
    onClose: () => void;
}

const MobileSideBar: React.FC<MobileSidebarProps> =({open, onClose}) => (
    <div className={`mobile-sidebar ${open ? 'visible': 'hidden'}`} id="mobileSidebar">
        <button className="close-button" onClick={onClose}>×</button>
        <div className="sidebar-content">
            <div className="sidebar-logo">Give&Get</div>
            <nav className="sidebar-links">
                <a href="/">Strona główna</a>
                <a href="/favourites">Ulubione</a>
                <a href="/messages">Wiadomości</a>
                <a href="/account">Moje konto</a>
            </nav>
        </div>
    </div>
);

export default MobileSideBar;