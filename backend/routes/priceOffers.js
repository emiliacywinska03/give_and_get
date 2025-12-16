const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

function authRequired(req, res, next) {
  try {
    const token = req.cookies?.gg_token;
    if (!token) return res.status(401).json({ ok: false, message: 'Brak sesji' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.uid };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'Sesja wygasła lub nieprawidłowa' });
  }
}

// 1) utworzenie oferty (buyer -> seller)
router.post('/', authRequired, async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { listingId, price } = req.body;

    const lid = Number(listingId);
    const p = Number(price);

    if (!Number.isFinite(lid) || lid <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe listingId.' });
    }
    if (!Number.isFinite(p) || p <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowa cena.' });
    }

    const listingRes = await pool.query(
      'SELECT id, user_id, type_id FROM listing WHERE id = $1',
      [lid]
    );

    if (listingRes.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ogłoszenie nie istnieje.' });
    }

    const listing = listingRes.rows[0];

    if (Number(listing.type_id) !== 1) {
      return res.status(400).json({ ok: false, error: 'Oferty ceny tylko dla ogłoszeń sprzedaży.' });
    }

    const sellerId = Number(listing.user_id);
    if (sellerId === buyerId) {
      return res.status(400).json({ ok: false, error: 'Nie możesz złożyć oferty na własne ogłoszenie.' });
    }

    const insert = await pool.query(
      `INSERT INTO price_offer (listing_id, buyer_id, seller_id, price, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, listing_id, buyer_id, seller_id, price, status, created_at`,
      [lid, buyerId, sellerId, p]
    );

    return res.status(201).json({ ok: true, offer: insert.rows[0] });
  } catch (e) {
    console.error('POST /price-offers error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});

// 2) akceptacja (seller)
router.post('/:id/accept', authRequired, async (req, res) => {
  try {
    const offerId = Number(req.params.id);
    const userId = req.user.id;

    const offerRes = await pool.query('SELECT * FROM price_offer WHERE id = $1', [offerId]);
    if (offerRes.rowCount === 0) return res.status(404).json({ ok: false, error: 'Oferta nie istnieje.' });

    const offer = offerRes.rows[0];
    if (Number(offer.seller_id) !== userId) {
      return res.status(403).json({ ok: false, error: 'Brak uprawnień.' });
    }

    // ustaw accepted + odrzuć inne pending dla tego listing (żeby nie było kilku zaakceptowanych)
    await pool.query(
      `UPDATE price_offer
       SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'rejected' END
       WHERE listing_id = $2 AND status = 'pending'`,
      [offerId, offer.listing_id]
    );

    // UWAGA: minimalna wersja – nadpisujemy cenę ogłoszenia
    await pool.query(
      `UPDATE listing SET price = $1 WHERE id = $2`,
      [offer.price, offer.listing_id]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /price-offers/:id/accept error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});

// 3) odrzucenie (seller)
router.post('/:id/reject', authRequired, async (req, res) => {
  try {
    const offerId = Number(req.params.id);
    const userId = req.user.id;

    const offerRes = await pool.query('SELECT * FROM price_offer WHERE id = $1', [offerId]);
    if (offerRes.rowCount === 0) return res.status(404).json({ ok: false, error: 'Oferta nie istnieje.' });

    const offer = offerRes.rows[0];
    if (Number(offer.seller_id) !== userId) {
      return res.status(403).json({ ok: false, error: 'Brak uprawnień.' });
    }

    await pool.query(`UPDATE price_offer SET status = 'rejected' WHERE id = $1`, [offerId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /price-offers/:id/reject error', e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});

module.exports = router;
