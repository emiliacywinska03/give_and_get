const express = require('express');
const { pool } = require('../db');
const { registerSchema, loginSchema, validate } = require('../validation/authSchemas.js');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

const recoverQuestionSchema = z.object({
  login: z.string().trim().min(3, 'Wpisz nazwę użytkownika lub e-mail.'),
});

const recoverResetSchema = z.object({
  login: z.string().trim().min(3, 'Wpisz nazwę użytkownika lub e-mail.'),
  security_answer: z
    .string()
    .trim()
    .min(3, 'Wpisz odpowiedź (min. 3 znaki).')
    .max(100, 'Wpisz krótszą odpowiedź (max 100 znaków).'),
  new_password: z.string().min(8, 'Hasło musi mieć min. 8 znaków.'),
});

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

router.get('/questions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, text
       FROM security_question
       WHERE active = TRUE AND locale = 'pl'
       ORDER BY sort_order, id`
    );
    return res.json({ ok: true, questions: rows });
  } catch (err) {
    console.error('Błąd przy pobieraniu pytań:', err);
    return res.status(500).json({ ok: false, error: 'Błąd serwera przy pobieraniu pytań' });
  }
});

router.post('/recover/question', validate(recoverQuestionSchema), async (req, res) => {
  const { login } = req.valid;

  try {
    const { rows } = await pool.query(
      `SELECT u.security_question_id AS id, q.text
       FROM "user" u
       JOIN security_question q ON q.id = u.security_question_id AND q.active = TRUE
       WHERE (u.username = $1 OR u.email = $1)
       LIMIT 1`,
      [login]
    );

    if (!rows[0]) {
      return res.status(404).json({ ok: false, errors: [{ message: 'Nie znaleziono użytkownika lub brak pytania weryfikacyjnego' }] });
    }

    return res.json({ ok: true, question: { id: rows[0].id, text: rows[0].text } });
  } catch (err) {
    console.error('Błąd recover/question:', err);
    return res.status(500).json({ ok: false, message: 'Błąd serwera' });
  }
});

router.post('/recover/reset', validate(recoverResetSchema), async (req, res) => {
  const { login, security_answer, new_password } = req.valid;

  try {
    const { rows } = await pool.query(
      `SELECT id, security_answer_hash
       FROM "user"
       WHERE username = $1 OR email = $1
       LIMIT 1`,
      [login]
    );

    const user = rows[0];
    if (!user || !user.security_answer_hash) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Nieprawidłowe dane odzyskiwania' }] });
    }

    const ok = await bcrypt.compare(security_answer, user.security_answer_hash);
    if (!ok) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Nieprawidłowa odpowiedź' }] });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE "user" SET password_hash = $1 WHERE id = $2`,
      [hash, user.id]
    );

    res.clearCookie('gg_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    return res.json({ ok: true, message: 'Hasło zostało zmienione. Możesz się zalogować.' });
  } catch (err) {
    console.error('Błąd recover/reset:', err);
    return res.status(500).json({ ok: false, message: 'Błąd serwera' });
  }
});

router.post('/register', validate(registerSchema), async (req, res) => {
  const {
    username,
    email,
    password,
    first_name,
    last_name,
    security_question_id,
    security_answer,
  } = req.valid;

  try {
    const exists = await pool.query(
      `SELECT 1 FROM "user" WHERE username = $1 OR email = $2 LIMIT 1`,
      [username, email]
    );
    if (exists.rowCount > 0) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Użytkownik lub e-mail już istnieje' }] });
    }

    const hash = await bcrypt.hash(password, 10);
    const answerHash = await bcrypt.hash(security_answer, 10);

    const insert = await pool.query(
      `INSERT INTO "user"
       (username, email, password_hash, first_name, last_name, security_question_id, security_answer_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, username, email`,
      [
        username,
        email,
        hash,
        first_name || null,
        last_name || null,
        security_question_id || null,
        answerHash,
      ]
    );

    return res.status(201).json({ ok: true, user: insert.rows[0] });
  } catch (err) {
    console.error('Błąd rejestracji:', err);
    return res.status(500).json({ ok: false, message: 'Błąd serwera przy rejestracji' });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { login, password } = req.valid;

  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, password_hash, avatar_url
       FROM "user"
       WHERE username = $1 OR email = $1
       LIMIT 1`,
      [login]
    );

    const user = rows[0];
    if (!user) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Nieprawidłowy login lub hasło' }] });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Nieprawidłowy login lub hasło' }] });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = user.avatar_url ? baseUrl + user.avatar_url : null;

    if (!process.env.JWT_SECRET) {
      console.warn('Brak JWT_SECRET w .env – token nie zostanie ustawiony');
      return res.json({
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: avatarUrl,
        },
        note: 'Brak JWT_SECRET – ustaw w .env, aby włączyć sesje przez cookie.',
      });
    }

    const token = jwt.sign({ uid: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('gg_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: avatarUrl,
      },
    });
  } catch (err) {
    console.error('Błąd logowania:', err);
    return res.status(500).json({ ok: false, message: 'Błąd serwera przy logowaniu' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, first_name, last_name, created_at, points, avatar_url
       FROM "user"
       WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ ok: false, message: 'Nie znaleziono użytkownika' });
    }

    const userRow = rows[0];
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = userRow.avatar_url ? baseUrl + userRow.avatar_url : null;

    return res.json({
      ok: true,
      user: {
        ...userRow,
        points: userRow.points ?? 0,
        avatar_url: avatarUrl,
      },
    });
  } catch (err) {
    console.error('Błąd /me:', err);
    return res.status(500).json({ ok: false, message: 'Błąd serwera' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('gg_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  });
  return res.json({ ok: true });
});

module.exports = router;