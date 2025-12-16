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
      return res.status(400).json({ ok: false, error: 'Brak ID ogłoszenia lub treści wiadomości.' });
    }

    const listingRes = await pool.query('SELECT id, user_id FROM listing WHERE id = $1', [listingId]);

    if (listingRes.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ogłoszenie nie istnieje.' });
    }

    const listing = listingRes.rows[0];
    const senderId = req.user.id;

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
      return res.status(400).json({ ok: false, error: 'Nie możesz wysłać wiadomości do siebie.' });
    }

    const insert = await pool.query(
      `INSERT INTO message (sender_id, receiver_id, listing_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, receiver_id, listing_id, content, created_at, is_read`,
      [senderId, finalReceiverId, listingId, content.trim()]
    );

    return res.status(201).json({ ok: true, message: insert.rows[0] });
  } catch (err) {
    console.error('Błąd podczas wysyłania wiadomości:', err);
    return res.status(500).json({ ok: false, error: 'Błąd serwera przy wysyłaniu wiadomości.' });
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
    return res.status(500).json({ ok: false, error: 'Błąd serwera przy pobieraniu nieprzeczytanych wiadomości.' });
  }
});

router.get('/inbox', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          m.*,
          CASE
            WHEN m.sender_id = $1 THEN m.receiver_id
            ELSE m.sender_id
          END AS other_user_id
        FROM message m
        WHERE m.sender_id = $1 OR m.receiver_id = $1
      ),
      last_msg AS (
        SELECT DISTINCT ON (listing_id, other_user_id)
          id, listing_id, other_user_id, sender_id, receiver_id, content, created_at, is_read
        FROM base
        ORDER BY listing_id, other_user_id, created_at DESC
      ),
      unread AS (
        SELECT listing_id, sender_id AS other_user_id, COUNT(*)::int AS unread_count
        FROM message
        WHERE receiver_id = $1 AND is_read = FALSE
        GROUP BY listing_id, sender_id
      )
      SELECT
        lm.id,
        lm.listing_id,
        lm.sender_id,
        lm.receiver_id,
        lm.other_user_id,
        lm.content,
        lm.created_at,
        lm.is_read,
        COALESCE(u.unread_count, 0) AS unread_count,
        l.title AS listing_title,
        l.type_id AS listing_type_id,
        ou.username AS other_username,
        ou.avatar_url AS other_avatar_url,
        (
          SELECT COALESCE(
            li.path,
            'data:' || li.mime || ';base64,' || encode(li.data,'base64')
          )
          FROM listing_images li
          WHERE li.listing_id = lm.listing_id
          ORDER BY COALESCE(li.sort_order, li.id) ASC, li.id ASC
          LIMIT 1
        ) AS listing_primary_image
      FROM last_msg lm
      JOIN listing l ON l.id = lm.listing_id
      JOIN "user" ou ON ou.id = lm.other_user_id
      LEFT JOIN unread u
        ON u.listing_id = lm.listing_id
       AND u.other_user_id = lm.other_user_id
      ORDER BY lm.created_at DESC
      `,
      [userId]
    );

    return res.json({ ok: true, threads: rows });
  } catch (err) {
    console.error('Inbox error:', err);
    return res.status(500).json({ ok: false, error: 'Błąd serwera' });
  }
});

router.get('/listing/:id', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe ID ogłoszenia.' });
    }

    const userId = req.user.id;

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const params = [listingId, userId];

    const beforeIdRaw = req.query.beforeId;
    const beforeId = beforeIdRaw ? Number(beforeIdRaw) : null;

    const otherUserIdRaw = req.query.otherUserId;
    const otherUserId = otherUserIdRaw ? Number(otherUserIdRaw) : null;

    if (Number.isFinite(otherUserId) && otherUserId > 0 && otherUserId === userId) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowy otherUserId.' });
    }

    let beforeIdx = null;
    if (Number.isFinite(beforeId) && beforeId > 0) {
      params.push(beforeId);
      beforeIdx = params.length;
    }

    let otherIdx = null;
    if (Number.isFinite(otherUserId) && otherUserId > 0) {
      params.push(otherUserId);
      otherIdx = params.length;
    }

    params.push(limit);
    const limitIdx = params.length;

    const senderSide = [
      'm.listing_id = $1',
      'm.sender_id = $2'
    ];
    const receiverSide = [
      'm.listing_id = $1',
      'm.receiver_id = $2'
    ];

    if (beforeIdx) {
      senderSide.push(`m.id < $${beforeIdx}`);
      receiverSide.push(`m.id < $${beforeIdx}`);
    }

    if (otherIdx) {
      senderSide.push(`m.receiver_id = $${otherIdx}`);
      receiverSide.push(`m.sender_id = $${otherIdx}`);
    }

    const { rows } = await pool.query(
      `
      SELECT
        x.id,
        x.sender_id,
        x.receiver_id,
        x.listing_id,
        x.content,
        x.created_at,
        x.is_read
      FROM (
        SELECT m.id, m.sender_id, m.receiver_id, m.listing_id, m.content, m.created_at, m.is_read
        FROM message m
        WHERE ${senderSide.join(' AND ')}
        UNION ALL
        SELECT m.id, m.sender_id, m.receiver_id, m.listing_id, m.content, m.created_at, m.is_read
        FROM message m
        WHERE ${receiverSide.join(' AND ')}
      ) x
      ORDER BY x.id DESC
      LIMIT $${limitIdx}
      `,
      params
    );

    if (Number.isFinite(otherUserId) && otherUserId > 0) {
      await pool.query(
        `
        UPDATE message
        SET is_read = TRUE
        WHERE receiver_id = $1
          AND listing_id = $2
          AND sender_id = $3
          AND is_read = FALSE
        `,
        [userId, listingId, otherUserId]
      );
    } else {
      await pool.query(
        `
        UPDATE message
        SET is_read = TRUE
        WHERE receiver_id = $1
          AND listing_id = $2
          AND is_read = FALSE
        `,
        [userId, listingId]
      );
    }

    const ordered = rows.sort((a, b) => Number(a.id) - Number(b.id));
    return res.json({ ok: true, messages: ordered });
  } catch (err) {
    console.error('Błąd przy pobieraniu wiadomości (listing):', err);
    return res.status(500).json({ ok: false, error: 'Błąd serwera przy pobieraniu wiadomości.' });
  }
});

module.exports = router;