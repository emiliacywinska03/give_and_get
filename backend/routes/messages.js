const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

function authRequired(req, res, next) {
  try {
    const token = req.cookies?.gg_token;
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Brak sesji' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.uid };
    next();
  } catch (e) {
    console.error('authRequired error:', e);
    return res.status(401).json({ ok: false, message: 'Sesja wygasła lub nieprawidłowa' });
  }
}


router.post('/', authRequired, async (req, res) => {
  try {
    const { listingId, content, receiverId } = req.body;

    if (!listingId || !content || !String(content).trim()) {
      return res
        .status(400)
        .json({ ok: false, error: 'Brak ID ogłoszenia lub treści wiadomości.' });
    }

    // znajdź ogłoszenie i jego autora
    const listingRes = await pool.query(
      'SELECT id, user_id FROM listing WHERE id = $1',
      [listingId]
    );

    if (listingRes.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ogłoszenie nie istnieje.' });
    }

    const listing = listingRes.rows[0];
    const senderId = req.user.id;

    // ustalamy odbiorcę:
    let finalReceiverId;

    if (receiverId) {
      const parsed = Number(receiverId);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ ok: false, error: 'Nieprawidłowy receiverId.' });
      }
      finalReceiverId = parsed;
    } else {
      finalReceiverId = listing.user_id;
    }

    if (finalReceiverId === senderId) {
      return res
        .status(400)
        .json({ ok: false, error: 'Nie możesz wysłać wiadomości do siebie.' });
    }

    const insert = await pool.query(
      `INSERT INTO message (sender_id, receiver_id, listing_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, receiver_id, listing_id, content, created_at, is_read`,
      [senderId, finalReceiverId, listingId, content.trim()]
    );

    return res.status(201).json({
      ok: true,
      message: insert.rows[0],
    });
  } catch (err) {
    console.error('Błąd podczas wysyłania wiadomości:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Błąd serwera przy wysyłaniu wiadomości.' });
  }
});


router.get('/unread-count', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      'SELECT COUNT(*) AS count FROM message WHERE receiver_id = $1 AND is_read = FALSE',
      [userId]
    );

    const count = Number(rows[0]?.count || 0);

    return res.json({ ok: true, count });
  } catch (err) {
    console.error('Błąd przy pobieraniu unread-count:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Błąd serwera przy pobieraniu nieprzeczytanych wiadomości.' });
  }
});


router.get('/inbox', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `
      SELECT
        m.id,
        m.content,
        m.created_at,
        m.is_read,
        m.listing_id,
        l.title AS listing_title,
        m.sender_id,
        su.username AS sender_username,
        m.receiver_id,
        ru.username AS receiver_username
      FROM message m
      JOIN listing l      ON l.id = m.listing_id
      JOIN "user" su      ON su.id = m.sender_id
      JOIN "user" ru      ON ru.id = m.receiver_id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY m.created_at DESC
      `,
      [userId]
    );

    // oznacz wszystkie odebrane jako przeczytane
    await pool.query(
      'UPDATE message SET is_read = TRUE WHERE receiver_id = $1 AND is_read = FALSE',
      [userId]
    );

    return res.json({ ok: true, messages: rows });
  } catch (err) {
    console.error('Błąd przy pobieraniu inboxu:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Błąd serwera przy pobieraniu wiadomości.' });
  }
});


router.get('/listing/:id', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    if (!listingId) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe ID ogłoszenia.' });
    }

    const userId = req.user.id;

    const { rows } = await pool.query(
      `
      SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.listing_id,
        m.content,
        m.created_at,
        m.is_read,
        su.username AS sender_username,
        ru.username AS receiver_username
      FROM message m
      JOIN "user" su ON su.id = m.sender_id
      JOIN "user" ru ON ru.id = m.receiver_id
      WHERE m.listing_id = $1
        AND (m.sender_id = $2 OR m.receiver_id = $2)
      ORDER BY m.created_at ASC
      `,
      [listingId, userId]
    );

    // oznacz jako przeczytane tylko w tej rozmowie
    await pool.query(
      'UPDATE message SET is_read = TRUE WHERE receiver_id = $1 AND listing_id = $2 AND is_read = FALSE',
      [userId, listingId]
    );

    return res.json({ ok: true, messages: rows });
  } catch (err) {
    console.error('Błąd przy pobieraniu wiadomości (listing):', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Błąd serwera przy pobieraniu wiadomości.' });
  }
});

module.exports = router;