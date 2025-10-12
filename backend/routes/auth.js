const express = require('express');
const { pool } = require('../db');
const { registerSchema, loginSchema, validate } = require('../validation/authSchemas.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

//sprawdzanie sesji na podstawie ciasteczka gg_token
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

// GET /api/auth/questions – lista pytań bezpieczeństwa
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

// POST /api/auth/register – rejestracja
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
    // unikalność username / email
    const exists = await pool.query(
      `SELECT 1 FROM "user" WHERE username = $1 OR email = $2 LIMIT 1`,
      [username, email]
    );
    if (exists.rowCount > 0) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Użytkownik lub e-mail już istnieje' }] });
    }

    // hash hasła i odpowiedzi weryfikacyjnej
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

// POST /api/auth/login – logowanie (login = username lub email)
router.post('/login', validate(loginSchema), async (req, res) => {
  const { login, password } = req.valid;

  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, password_hash
       FROM "user"
       WHERE username = $1 OR email = $1
       LIMIT 1`,
      [login]
    );

    if (rows.length === 0) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Nieprawidłowy login lub hasło' }] });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(400).json({ ok: false, errors: [{ message: 'Nieprawidłowy login lub hasło' }] });
    }

    if (!process.env.JWT_SECRET) {
      console.warn('Brak JWT_SECRET w .env – token nie zostanie ustawiony');
      return res.json({
        ok: true,
        user: { id: user.id, username: user.username, email: user.email },
        note: 'Brak JWT_SECRET – ustaw w .env, aby włączyć sesje przez cookie.',
      });
    }

    const token = jwt.sign({ uid: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('gg_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.json({ ok: true, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('Błąd logowania:', err);
    return res.status(500).json({ ok: false, message: 'Błąd serwera przy logowaniu' });
  }
});

// GET /api/auth/me – dane aktualnie zalogowanego użytkownika (do zakładki „Moje konto”)
router.get('/me', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, first_name, last_name, created_at
       FROM "user" WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Nie znaleziono użytkownika' });
    return res.json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error('Błąd /me:', err);
    return res.status(500).json({ ok: false, message: 'Błąd serwera' });
  }
});

module.exports = router;