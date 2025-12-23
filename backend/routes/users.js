const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const bcrypt = require('bcrypt');


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


router.patch('/me', authRequired, async (req, res) => {
  try {
    const { username, email, first_name, last_name } = req.body || {};

    // prosta walidacja
    if (!username || String(username).trim().length < 3) {
      return res.status(400).json({ error: 'Nazwa użytkownika min. 3 znaki' });
    }
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'Niepoprawny email' });
    }

    // sprawdź czy username/email nie zajęte przez kogoś innego
    const exists = await pool.query(
      `SELECT id FROM "user"
       WHERE (username = $1 OR email = $2) AND id <> $3
       LIMIT 1`,
      [username.trim(), email.trim(), req.user.id]
    );
    if (exists.rowCount > 0) {
      return res.status(400).json({ error: 'Nazwa użytkownika lub e-mail jest już zajęty' });
    }

    // update
    await pool.query(
      `UPDATE "user"
       SET username = $1,
           email = $2,
           first_name = $3,
           last_name = $4
       WHERE id = $5`,
      [
        username.trim(),
        email.trim(),
        first_name ? String(first_name).trim() : null,
        last_name ? String(last_name).trim() : null,
        req.user.id,
      ]
    );

    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, created_at, points, avatar_url, avatar_data, avatar_mime
       FROM "user"
       WHERE id = $1`,
      [req.user.id]
    );

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
    console.error('Błąd PATCH /users/me:', err);
    return res.status(500).json({ error: 'Błąd serwera podczas zapisu profilu' });
  }
});


router.post('/change-password', authRequired, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Brak danych do zmiany hasła' });
    }
    if (String(new_password).length < 8) {
      return res.status(400).json({ error: 'Nowe hasło musi mieć min. 8 znaków' });
    }

    const { rows } = await pool.query(
      `SELECT password_hash FROM "user" WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Użytkownik nie istnieje' });

    const ok = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Aktualne hasło jest niepoprawne' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE "user" SET password_hash = $1 WHERE id = $2`,
      [hash, req.user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Błąd POST /users/change-password:', err);
    return res.status(500).json({ error: 'Błąd serwera podczas zmiany hasła' });
  }
});


module.exports = router;