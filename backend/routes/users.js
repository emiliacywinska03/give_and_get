const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}


const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `avatar-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
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


router.post(
  '/avatar',
  authRequired,
  upload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Brak pliku' });
      }

      const relativePath = `/uploads/avatars/${req.file.filename}`;

      const result = await pool.query(
        `UPDATE "user"
         SET avatar_url = $1
         WHERE id = $2
         RETURNING id, avatar_url`,
        [relativePath, req.user.id]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: 'Użytkownik nie został znaleziony' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fullUrl = baseUrl + result.rows[0].avatar_url;

      return res.json({
        ok: true,
        avatar_url: fullUrl,
        avatarUrl: fullUrl, 
      });
    } catch (err) {
      console.error('Błąd przy zapisie avatara:', err);
      return res.status(500).json({
        error: 'Błąd serwera podczas zapisywania zdjęcia profilowego',
      });
    }
  }
);


router.get('/me', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, created_at, points, avatar_url
       FROM "user"
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'Użytkownik nie został znaleziony' });
    }

    const user = result.rows[0];
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return res.json({
      ...user,
      avatar_url: user.avatar_url ? baseUrl + user.avatar_url : null,
    });
  } catch (err) {
    console.error('Błąd pobierania /me:', err);
    return res.status(500).json({ error: 'Błąd serwera przy /me' });
  }
});

module.exports = router;