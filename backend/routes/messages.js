const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { pool } = require('../db');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function maybeUploadSingle(field) {
  return (req, res, next) => {
    const ct = String(req.headers['content-type'] || '');
    if (ct.startsWith('multipart/form-data')) {
      return upload.single(field)(req, res, next);
    }
    return next();
  };
}

const avatarSql = (alias) => `CASE
  WHEN ${alias}.avatar_url IS NOT NULL THEN ${alias}.avatar_url
  WHEN ${alias}.avatar_data IS NOT NULL AND ${alias}.avatar_mime IS NOT NULL
    THEN 'data:' || ${alias}.avatar_mime || ';base64,' || encode(${alias}.avatar_data,'base64')
  ELSE NULL
END`;

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

router.post('/', authRequired, maybeUploadSingle('attachment'), async (req, res) => {
  try {
    const { listingId, content, receiverId } = req.body;

    const trimmed = String(content || '').trim();
    const file = req.file || null;

    const isHelpApply = trimmed.startsWith('Zgłoszenie do ogłoszenia:');

    if (!listingId || (!trimmed && !file)) {
      return res.status(400).json({ ok: false, error: 'Brak ID ogłoszenia lub treści wiadomości.' });
    }
    const lr = await pool.query('SELECT type_id FROM listing WHERE id = $1 LIMIT 1', [listingId]);
    const listingTypeId = lr.rowCount ? Number(lr.rows[0].type_id) : null;

    let attachmentData = null;
    let attachmentMime = null;
    let attachmentName = null;
    let attachmentSize = null;

    if (file) {
      const name = String(file.originalname || '');
      const lower = name.toLowerCase();
      const mime = String(file.mimetype || '');

      if (Number(listingTypeId) === 3) {
        const isPdf = mime === 'application/pdf' || lower.endsWith('.pdf');
        if (!isPdf) {
          return res.status(400).json({ ok: false, error: 'W ogłoszeniach o pracę dozwolony jest tylko PDF.' });
        }
        attachmentData = file.buffer;
        attachmentMime = 'application/pdf';
        attachmentName = name || 'CV.pdf';
        attachmentSize = Number(file.size || 0);
      } else {
        const isImage = mime.startsWith('image/');
        if (!isImage) {
          return res.status(400).json({ ok: false, error: 'W tym ogłoszeniu dozwolone są tylko zdjęcia.' });
        }
        attachmentData = file.buffer;
        attachmentMime = mime || 'image/jpeg';
        attachmentName = name || 'Zdjęcie';
        attachmentSize = Number(file.size || 0);
      }
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

    if (isHelpApply && !file) {
      const existing = await pool.query(
        `
        SELECT id
        FROM message
        WHERE listing_id = $1
          AND sender_id = $2
          AND receiver_id = $3
          AND content LIKE 'Zgłoszenie do ogłoszenia:%'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [listingId, senderId, finalReceiverId]
      );

      if (existing.rowCount) {
        const mid = existing.rows[0].id;

        const upd = await pool.query(
          `WITH upd AS (
             UPDATE message
             SET content = $4
             WHERE id = $1
             RETURNING
               id,
               sender_id,
               receiver_id,
               listing_id,
               content,
               created_at,
               is_read
           )
           SELECT
             upd.id,
             upd.sender_id,
             upd.receiver_id,
             upd.listing_id,
             upd.content,
             upd.created_at,
             upd.is_read,
             su.username AS sender_username,
             ru.username AS receiver_username,
             ${avatarSql('su')} AS sender_avatar_url,
             ${avatarSql('ru')} AS receiver_avatar_url
           FROM upd
           JOIN "user" su ON su.id = upd.sender_id
           JOIN "user" ru ON ru.id = upd.receiver_id`,
          [mid, senderId, finalReceiverId, trimmed]
        );

        const message = upd.rows[0];
        message.attachment_url = null;
        message.attachment_name = null;
        message.attachment_mime = null;
        message.attachment_size = null;

        const io = req.app.get('io');
        if (io && message) {
          io.to(`user_${finalReceiverId}`).emit('chat:new-message', message);
          io.to(`user_${senderId}`).emit('chat:new-message', message);

          io.to(`user_${finalReceiverId}`).emit('chat:unread-bump', {
            listingId: Number(message.listing_id),
            fromUserId: Number(message.sender_id),
          });
        }

        return res.status(200).json({ ok: true, message, updated: true });
      }
    }

    const insert = await pool.query(
      `WITH ins AS (
         INSERT INTO message (
           sender_id,
           receiver_id,
           listing_id,
           content
         )
         VALUES ($1, $2, $3, $4)
         RETURNING
           id,
           sender_id,
           receiver_id,
           listing_id,
           content,
           created_at,
           is_read
       )
       SELECT
         ins.id,
         ins.sender_id,
         ins.receiver_id,
         ins.listing_id,
         ins.content,
         ins.created_at,
         ins.is_read,
         su.username AS sender_username,
         ru.username AS receiver_username,
         ${avatarSql('su')} AS sender_avatar_url,
         ${avatarSql('ru')} AS receiver_avatar_url
       FROM ins
       JOIN "user" su ON su.id = ins.sender_id
       JOIN "user" ru ON ru.id = ins.receiver_id`,
      [senderId, finalReceiverId, listingId, trimmed]
    );

    const message = insert.rows[0];

    if (message && attachmentData && attachmentMime && attachmentName) {
      await pool.query(
        `INSERT INTO message_attachment (message_id, data, mime, name, size)
         VALUES ($1, $2, $3, $4, $5)`,
        [message.id, attachmentData, attachmentMime, attachmentName, attachmentSize || 0]
      );

      message.attachment_url = `/api/messages/attachment/${message.id}`;
      message.attachment_name = attachmentName;
      message.attachment_mime = attachmentMime;
      message.attachment_size = attachmentSize || 0;
    } else {
      message.attachment_url = null;
      message.attachment_name = null;
      message.attachment_mime = null;
      message.attachment_size = null;
    }

    const io = req.app.get('io');
    if (io && message) {
      io.to(`user_${finalReceiverId}`).emit('chat:new-message', message);
      io.to(`user_${senderId}`).emit('chat:new-message', message);

      io.to(`user_${finalReceiverId}`).emit('chat:unread-bump', {
        listingId: Number(message.listing_id),
        fromUserId: Number(message.sender_id),
      });
    }

    return res.status(201).json({ ok: true, message });
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
    ),
    negotiation_threads AS (
      SELECT
        (0 - pn.id) AS id,
        pn.listing_id,
        pn.buyer_id AS sender_id,
        pn.seller_id AS receiver_id,
        CASE
          WHEN pn.buyer_id = $1 THEN pn.seller_id
          ELSE pn.buyer_id
        END AS other_user_id,
        ''::text AS content,
        pn.created_at AS created_at,
        TRUE AS is_read,
        0::int AS unread_count
      FROM price_negotiation pn
      WHERE (pn.buyer_id = $1 OR pn.seller_id = $1)
        AND NOT EXISTS (
          SELECT 1
          FROM message m
          WHERE m.listing_id = pn.listing_id
            AND (
              (m.sender_id = $1 AND m.receiver_id = CASE WHEN pn.buyer_id = $1 THEN pn.seller_id ELSE pn.buyer_id END)
              OR
              (m.receiver_id = $1 AND m.sender_id = CASE WHEN pn.buyer_id = $1 THEN pn.seller_id ELSE pn.buyer_id END)
            )
        )
    ),
    threads AS (
      SELECT
        lm.id,
        lm.listing_id,
        lm.sender_id,
        lm.receiver_id,
        lm.other_user_id,
        lm.content,
        lm.created_at,
        lm.is_read,
        COALESCE(u.unread_count, 0) AS unread_count
      FROM last_msg lm
      LEFT JOIN unread u
        ON u.listing_id = lm.listing_id
      AND u.other_user_id = lm.other_user_id

      UNION ALL

      SELECT
        nt.id,
        nt.listing_id,
        nt.sender_id,
        nt.receiver_id,
        nt.other_user_id,
        nt.content,
        nt.created_at,
        nt.is_read,
        nt.unread_count
      FROM negotiation_threads nt
    )
    SELECT
      t.id,
      t.listing_id,
      t.sender_id,
      t.receiver_id,
      t.other_user_id,
      t.content,
      t.created_at,
      t.is_read,
      t.unread_count,
      l.title AS listing_title,
      l.type_id AS listing_type_id,
      ou.username AS other_username,
      ${avatarSql('ou')} AS other_avatar_url,
      (
        SELECT COALESCE(
          li.path,
          'data:' || li.mime || ';base64,' || encode(li.data,'base64')
        )
        FROM listing_images li
        WHERE li.listing_id = t.listing_id
        ORDER BY COALESCE(li.sort_order, li.id) ASC, li.id ASC
        LIMIT 1
      ) AS listing_primary_image
    FROM threads t
    JOIN listing l ON l.id = t.listing_id
    JOIN "user" ou ON ou.id = t.other_user_id
    ORDER BY t.created_at DESC
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
        x.is_read,
        x.sender_username,
        x.receiver_username,
        x.sender_avatar_url,
        x.receiver_avatar_url,
        x.attachment_url,
        x.attachment_name,
        x.attachment_mime,
        x.attachment_size
      FROM (
        SELECT
          m.id,
          m.sender_id,
          m.receiver_id,
          m.listing_id,
          m.content,
          m.created_at,
          m.is_read,
          CASE WHEN ma.message_id IS NOT NULL THEN '/api/messages/attachment/' || m.id ELSE NULL END AS attachment_url,
          ma.name AS attachment_name,
          ma.mime AS attachment_mime,
          ma.size AS attachment_size,
          su.username AS sender_username,
          ru.username AS receiver_username,
          ${avatarSql('su')} AS sender_avatar_url,
          ${avatarSql('ru')} AS receiver_avatar_url
        FROM message m
        JOIN "user" su ON su.id = m.sender_id
        JOIN "user" ru ON ru.id = m.receiver_id
        LEFT JOIN message_attachment ma ON ma.message_id = m.id
        WHERE ${senderSide.join(' AND ')}

        UNION ALL

        SELECT
          m.id,
          m.sender_id,
          m.receiver_id,
          m.listing_id,
          m.content,
          m.created_at,
          m.is_read,
          CASE WHEN ma.message_id IS NOT NULL THEN '/api/messages/attachment/' || m.id ELSE NULL END AS attachment_url,
          ma.name AS attachment_name,
          ma.mime AS attachment_mime,
          ma.size AS attachment_size,
          su.username AS sender_username,
          ru.username AS receiver_username,
          ${avatarSql('su')} AS sender_avatar_url,
          ${avatarSql('ru')} AS receiver_avatar_url
        FROM message m
        JOIN "user" su ON su.id = m.sender_id
        JOIN "user" ru ON ru.id = m.receiver_id
        LEFT JOIN message_attachment ma ON ma.message_id = m.id
        WHERE ${receiverSide.join(' AND ')}
      ) x
      ORDER BY x.id DESC
      LIMIT $${limitIdx}
      `,
      params
    );

    let markedSenders = [];

    if (Number.isFinite(otherUserId) && otherUserId > 0) {
      const r = await pool.query(
        `
        UPDATE message
        SET is_read = TRUE
        WHERE receiver_id = $1
          AND listing_id = $2
          AND sender_id = $3
          AND is_read = FALSE
        RETURNING sender_id
        `,
        [userId, listingId, otherUserId]
      );
      markedSenders = r.rows.map((x) => Number(x.sender_id)).filter((x) => Number.isFinite(x) && x > 0);
    } else {
      const r = await pool.query(
        `
        UPDATE message
        SET is_read = TRUE
        WHERE receiver_id = $1
          AND listing_id = $2
          AND is_read = FALSE
        RETURNING sender_id
        `,
        [userId, listingId]
      );
      markedSenders = r.rows.map((x) => Number(x.sender_id)).filter((x) => Number.isFinite(x) && x > 0);
    }

    const uniqueSenders = Array.from(new Set(markedSenders)).filter((sid) => sid !== userId);

    const io = req.app.get('io');
    if (io) {
      for (const sid of uniqueSenders) {
        io.to(`user_${sid}`).emit('chat:read', {
          listingId,
          byUserId: userId,
          otherUserId: sid,
        });
      }
    }

    let peer = null;

    if (Number.isFinite(otherUserId) && otherUserId > 0) {
      const peerRes = await pool.query(
        `SELECT
           id,
           username,
           ${avatarSql('"user"')} AS avatar_url
         FROM "user"
         WHERE id = $1
         LIMIT 1`,
        [otherUserId]
      );
      if (peerRes.rowCount > 0) {
        peer = peerRes.rows[0];
      }
    }

    const ordered = rows.sort((a, b) => Number(a.id) - Number(b.id));
    return res.json({ ok: true, messages: ordered, peer });
  } catch (err) {
    console.error('Błąd przy pobieraniu wiadomości (listing):', err);
    return res.status(500).json({ ok: false, error: 'Błąd serwera przy pobieraniu wiadomości.' });
  }
});

router.get('/attachment/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).send('Nieprawidłowe ID');
    }

    const userId = req.user.id;

    const r = await pool.query(
      `SELECT
         m.id,
         m.sender_id,
         m.receiver_id,
         ma.data AS attachment_data,
         ma.mime AS attachment_mime,
         ma.name AS attachment_name
       FROM message m
       JOIN message_attachment ma ON ma.message_id = m.id
       WHERE m.id = $1
       LIMIT 1`,
      [id]
    );

    if (r.rowCount === 0) {
      return res.status(404).send('Nie znaleziono');
    }

    const row = r.rows[0];

    const allowed = Number(row.sender_id) === Number(userId) || Number(row.receiver_id) === Number(userId);
    if (!allowed) {
      return res.status(403).send('Brak dostępu');
    }

    if (!row.attachment_data || !row.attachment_mime) {
      return res.status(404).send('Brak załącznika');
    }

    const name = row.attachment_name || 'Zalacznik.pdf';

    res.setHeader('Content-Type', row.attachment_mime);
    res.setHeader('Content-Disposition', `inline; filename="${String(name).replace(/"/g, '')}"`);
    return res.status(200).send(row.attachment_data);
  } catch (err) {
    console.error('Błąd przy pobieraniu załącznika:', err);
    return res.status(500).send('Błąd serwera');
  }
});


router.post('/mark-read', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = Number(req.body.listingId);
    const otherUserId = Number(req.body.otherUserId);

    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe listingId.' });
    }
    if (!Number.isFinite(otherUserId) || otherUserId <= 0) {
      return res.status(400).json({ ok: false, error: 'Nieprawidłowe otherUserId.' });
    }

    const r = await pool.query(
      `
      UPDATE message
      SET is_read = TRUE
      WHERE receiver_id = $1
        AND listing_id = $2
        AND sender_id = $3
        AND is_read = FALSE
      RETURNING id
      `,
      [userId, listingId, otherUserId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('chat:read', {
        listingId,
        byUserId: userId,
        otherUserId,
      });
    }

    return res.json({ ok: true, updated: r.rowCount });
  } catch (err) {
    console.error('mark-read error:', err);
    return res.status(500).json({ ok: false, error: 'Błąd serwera.' });
  }
});


module.exports = router;