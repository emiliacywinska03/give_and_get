import React from "react";
import "./MobileSidebar.css";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

const MobileSidebar: React.FC<MobileSidebarProps> = ({ open, onClose }) => {
  const { user, logout } = useAuth();

  return (
    <div
      className={`mobile-sidebar ${open ? "visible" : "hidden"}`}
      id="mobileSidebar"
    >
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <div className="sidebar-content">
        <div className="sidebar-logo">Give&amp;Get</div>

        {/* Główne linki z headera */}
        <nav className="sidebar-links">
          <Link to="/" onClick={onClose}>
            Strona główna
          </Link>
          <Link to="/rewards" onClick={onClose}>
            Nagrody
          </Link>
          <Link to="/favorites" onClick={onClose}>
            Ulubione
          </Link>
          <Link to="/featured" onClick={onClose}>
            Wyróżnione
          </Link>
          <Link to="/messages" onClick={onClose}>
            Wiadomości
          </Link>
          <Link to="/history" onClick={onClose}>
            Historia ogłoszeń
          </Link>
        </nav>

        {/* Sekcja konta*/}
        <nav className="sidebar-links">
          {user ? (
            <>
              <Link to="/listings/create" onClick={onClose}>
                Dodaj ogłoszenie
              </Link>
              <Link to="/profile" onClick={onClose}>
                Mój profil
              </Link>
              <button
                onClick={() => { onClose(); logout(); }}
                className="logout-button"
                style={{ padding: "0.75rem 1rem", textAlign: "left", background: "none", border: "none", fontSize: "1rem", cursor: "pointer" }}
              >
                Wyloguj
              </button>
            </>
          ) : (
            <Link to="/auth" onClick={onClose}>
              Zaloguj
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
};

export default MobileSidebar;