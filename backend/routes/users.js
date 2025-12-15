const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

function authRequired(req, res, next) {
  try {
    const token = req.cookies?.gg_token;
    if (!token) {
      return res.status(401).json({ error: 'Brak sesji' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.uid };
    next();
  } catch (err) {
    console.error('Błąd JWT w users.js:', err.message);
    return res
      .status(401)
      .json({ error: 'Sesja wygasła lub nieprawidłowa' });
  }
}

router.post('/avatar', authRequired, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku' });
    }

    const avatarBuffer = req.file.buffer;
    const avatarMime = req.file.mimetype;

    const result = await pool.query(
      `UPDATE "user"
       SET avatar_data = $1,
           avatar_mime = $2,
           avatar_url = NULL
       WHERE id = $3
       RETURNING id`,
      [avatarBuffer, avatarMime, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarEndpoint = `${baseUrl}/api/users/me/avatar`;

    return res.json({ ok: true, avatar_url: avatarEndpoint, avatarUrl: avatarEndpoint });
  } catch (err) {
    console.error('Błąd przy zapisie avatara:', err);
    return res.status(500).json({ error: 'Błąd serwera podczas zapisywania zdjęcia profilowego' });
  }
});

router.get('/me/avatar', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT avatar_data, avatar_mime
       FROM "user"
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    const { avatar_data, avatar_mime } = result.rows[0];

    if (!avatar_data) {
      return res.status(404).json({ error: 'Brak avatara' });
    }

    res.setHeader('Content-Type', avatar_mime || 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(avatar_data);
  } catch (err) {
    console.error('Błąd pobierania avatara /me/avatar:', err);
    return res.status(500).json({ error: 'Błąd serwera podczas pobierania avatara' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, created_at, points, avatar_url, avatar_data, avatar_mime
       FROM "user"
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    const user = result.rows[0];
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarFromDb = user.avatar_data ? `${baseUrl}/api/users/me/avatar` : null;

    delete user.avatar_data;
    delete user.avatar_mime;

    return res.json({
      ...user,
      avatar_url: avatarFromDb || (user.avatar_url ? baseUrl + user.avatar_url : null),
    });
  } catch (err) {
    console.error('Błąd pobierania /me:', err);
    return res.status(500).json({ error: 'Błąd serwera przy /me' });
  }
});

module.exports = router;