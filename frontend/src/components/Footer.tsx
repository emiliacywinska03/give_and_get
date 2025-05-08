import React from "react";

export{};

const Footer: React.FC = () => (
    <footer>
        <div className="footer-content">
            <p className="footer-text">© Give&Get Wszelkie  prawa zastżerzone.</p>
            <div className="footer-links">
                <a href="/terms" className="footer-link">Regulamin</a>
                <a href="/privacy" className="footer-link">Prywatność</a>
                <a href="/contact" className="footer-link">Kontakt</a>
            </div>
        </div>
    </footer>
)

export default Footer;