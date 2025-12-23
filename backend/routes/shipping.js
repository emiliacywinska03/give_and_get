const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

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

    let buyerId = null;
    let sellerId = null;

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
    } else {
      
      const pr2 = await pool.query(
        `SELECT buyer_id, seller_id
         FROM price_negotiation
         WHERE listing_id = $1 AND status = 'accepted'
         ORDER BY id DESC
         LIMIT 1`,
        [listingId]
      );
      if (!pr2.rowCount) {
        return res.status(404).json({ ok: false, error: 'Nie znaleziono zakupu/negocjacji dla tego ogłoszenia' });
      }
      buyerId = Number(pr2.rows[0].buyer_id);
      sellerId = Number(pr2.rows[0].seller_id);
    }

    if (userId !== sellerId) {
      return res.status(403).json({ ok: false, error: 'Tylko sprzedający może oznaczyć wysyłkę' });
    }

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

module.exports = router;
