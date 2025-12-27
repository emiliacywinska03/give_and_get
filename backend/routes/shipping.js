const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

async function ensureShippingStatusSchema() {
  const ensureTable = `
    CREATE TABLE IF NOT EXISTS shipping_status (
      listing_id INT PRIMARY KEY,
      seller_id INT NOT NULL,
      buyer_id INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'none',
      packed_at TIMESTAMPTZ NULL,
      sent_at TIMESTAMPTZ NULL
    )
  `;
  await pool.query(ensureTable);
}

async function ensureShippingDetailsSchema() {
  const ensureTable = `
    CREATE TABLE IF NOT EXISTS shipping_details (
      id BIGSERIAL PRIMARY KEY,
      listing_id INT NOT NULL UNIQUE,
      seller_id INT NOT NULL,
      buyer_id INT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      street TEXT NOT NULL,
      zip TEXT NOT NULL,
      city TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await pool.query(ensureTable);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipping_details_listing_id ON shipping_details(listing_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipping_details_seller_id ON shipping_details(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipping_details_buyer_id ON shipping_details(buyer_id)`);
}

async function getBuyerSellerForListing(listingId) {
  let buyerId = null;
  let sellerId = null;

  const so = await pool.query(
    `SELECT buyer_id, seller_id
     FROM seller_order
     WHERE listing_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [listingId]
  ).catch(() => ({ rowCount: 0, rows: [] }));

  if (so.rowCount) {
    buyerId = Number(so.rows[0].buyer_id);
    sellerId = Number(so.rows[0].seller_id);
    return { buyerId, sellerId };
  }

  const pr1 = await pool.query(
    `SELECT buyer_id, seller_id
     FROM purchase
     WHERE listing_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [listingId]
  ).catch(() => ({ rowCount: 0, rows: [] }));

  if (pr1.rowCount) {
    buyerId = Number(pr1.rows[0].buyer_id);
    sellerId = Number(pr1.rows[0].seller_id);
    return { buyerId, sellerId };
  }

  const pr2 = await pool.query(
    `SELECT buyer_id, seller_id
     FROM price_negotiation
     WHERE listing_id = $1 AND status = 'accepted'
     ORDER BY id DESC
     LIMIT 1`,
    [listingId]
  ).catch(() => ({ rowCount: 0, rows: [] }));

  if (!pr2.rowCount) return { buyerId: null, sellerId: null };

  buyerId = Number(pr2.rows[0].buyer_id);
  sellerId = Number(pr2.rows[0].seller_id);
  return { buyerId, sellerId };
}

function authRequired(req, res, next) {
  try {
    const token = req.cookies?.gg_token;
    if (!token) return res.status(401).json({ ok: false, error: 'Brak sesji' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.uid };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Sesja wygasła lub nieprawidłowa' });
  }
}

router.patch('/:listingId', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.listingId);
    const status = String(req.body?.status || '').trim();

    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe listingId' });
    }
    if (status !== 'sent') {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowy status (sent)' });
    }
    

    const userId = req.user.id;

    const { buyerId, sellerId } = await getBuyerSellerForListing(listingId);

    if (!buyerId || !sellerId) {
      return res.status(404).json({ ok: false, error: 'Nie znaleziono zakupu/negocjacji dla tego ogłoszenia' });
    }

    if (userId !== sellerId) {
      return res.status(403).json({ ok: false, error: 'Tylko sprzedający może oznaczyć wysyłkę' });
    }

    await ensureShippingStatusSchema();
    await ensureShippingDetailsSchema();

    const now = new Date().toISOString();

    // update / insert status
    const upd = await pool.query(
      `
      INSERT INTO shipping_status (listing_id, seller_id, buyer_id, status, sent_at)
      VALUES ($1, $2, $3, 'sent', $4::timestamptz)
      ON CONFLICT (listing_id)
      DO UPDATE SET
        status = 'sent',
        sent_at = COALESCE(shipping_status.sent_at, EXCLUDED.sent_at)
      RETURNING status, sent_at
      `,
      [listingId, sellerId, buyerId, now]
    );
    
    // 1b) przenieś ogłoszenie do "zakończone" (status_id = 4)
    await pool.query(
      `UPDATE listing SET status_id = 4 WHERE id = $1`,
      [listingId]
    );


    // 2) dodaj “systemową wiadomość” do message (będzie widoczna w czacie)
    const text = 'Paczka została wysłana.';

    // wrzucamy jako normalną wiadomość od sprzedającego do kupującego
    const insertMsg = await pool.query(
      `
      WITH ins AS (
        INSERT INTO message (sender_id, receiver_id, listing_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, sender_id, receiver_id, listing_id, content, created_at, is_read
      )
      SELECT
        ins.*,
        su.username AS sender_username,
        ru.username AS receiver_username,
        CASE
          WHEN su.avatar_url IS NOT NULL THEN su.avatar_url
          WHEN su.avatar_data IS NOT NULL AND su.avatar_mime IS NOT NULL
            THEN 'data:' || su.avatar_mime || ';base64,' || encode(su.avatar_data,'base64')
          ELSE NULL
        END AS sender_avatar_url,
        CASE
          WHEN ru.avatar_url IS NOT NULL THEN ru.avatar_url
          WHEN ru.avatar_data IS NOT NULL AND ru.avatar_mime IS NOT NULL
            THEN 'data:' || ru.avatar_mime || ';base64,' || encode(ru.avatar_data,'base64')
          ELSE NULL
        END AS receiver_avatar_url
      FROM ins
      JOIN "user" su ON su.id = ins.sender_id
      JOIN "user" ru ON ru.id = ins.receiver_id
      `,
      [sellerId, buyerId, listingId, text]
    );

    const msg = insertMsg.rows[0];

    // 3) socket emit do obu stron 
    const io = req.app.get('io');
    if (io && msg) {
      io.to(`user_${buyerId}`).emit('chat:new-message', msg);
      io.to(`user_${sellerId}`).emit('chat:new-message', msg);

      io.to(`user_${buyerId}`).emit('chat:unread-bump', {
        listingId: Number(msg.listing_id),
        fromUserId: Number(msg.sender_id),
      });
    }

    return res.json({ ok: true, shipping: upd.rows[0], message: msg });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera' });
  }
});

router.post('/details/:listingId', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe listingId' });
    }

    const fullName = String(req.body?.fullName || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim();
    const street = String(req.body?.street || '').trim();
    const zip = String(req.body?.zip || '').trim();
    const city = String(req.body?.city || '').trim();

    if (!fullName || !phone || !email || !street || !zip || !city) {
      return res.status(400).json({ ok: false, error: 'Brak danych do wysyłki. Uzupełnij: imię i nazwisko, telefon, e-mail, ulica i numer, kod, miasto.' });
    }

    await ensureShippingDetailsSchema();

    const buyerId = req.user.id;

    const lq = await pool.query(
      `SELECT user_id FROM listing WHERE id = $1 LIMIT 1`,
      [listingId]
    );

    if (!lq.rowCount) {
      return res.status(404).json({ ok: false, error: 'Ogłoszenie nie istnieje' });
    }

    const sellerId = Number(lq.rows[0].user_id);

    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      return res.status(500).json({ ok: false, error: 'Błąd danych sprzedającego' });
    }

    if (buyerId === sellerId) {
      return res.status(400).json({ ok: false, error: 'Nie możesz kupić własnego ogłoszenia' });
    }

    const upsert = await pool.query(
      `
      INSERT INTO shipping_details (listing_id, seller_id, buyer_id, full_name, phone, email, street, zip, city)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (listing_id)
      DO UPDATE SET
        seller_id = EXCLUDED.seller_id,
        buyer_id = EXCLUDED.buyer_id,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        street = EXCLUDED.street,
        zip = EXCLUDED.zip,
        city = EXCLUDED.city
      RETURNING listing_id, seller_id, buyer_id, full_name, phone, email, street, zip, city, created_at
      `,
      [listingId, sellerId, buyerId, fullName, phone, email, street, zip, city]
    );

    return res.json({ ok: true, shipping: upsert.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera' });
  }
});

router.get('/details/:listingId', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe listingId' });
    }

    await ensureShippingDetailsSchema();

    const userId = req.user.id;

    const lq = await pool.query(
      `SELECT user_id FROM listing WHERE id = $1 LIMIT 1`,
      [listingId]
    );

    if (!lq.rowCount) {
      return res.status(404).json({ ok: false, error: 'Ogłoszenie nie istnieje' });
    }

    const sellerId = Number(lq.rows[0].user_id);

    if (userId !== sellerId) {
      return res.status(403).json({ ok: false, error: 'Brak dostępu' });
    }

    const row = await pool.query(
      `SELECT listing_id, seller_id, buyer_id, full_name, phone, email, street, zip, city, created_at
       FROM shipping_details
       WHERE listing_id = $1
       LIMIT 1`,
      [listingId]
    );

    if (!row.rowCount) {
      return res.status(404).json({ ok: false, error: 'Brak danych do wysyłki dla tego ogłoszenia' });
    }

    return res.json({ ok: true, shipping: row.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Błąd serwera' });
  }
});

module.exports = router;
