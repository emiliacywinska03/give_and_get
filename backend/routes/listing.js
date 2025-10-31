const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { pool } = require('../db');

// Middleware sprawdzający autoryzację
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

// Słowniki pomocnicze
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM category ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania kategorii:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

router.get('/subcategories', async (req, res) => {
  try {
    const { category_id } = req.query;
    if (!category_id) return res.status(400).json({ error: 'category_id wymagane' });
    const idNum = Number(category_id);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Nieprawidlowe category_id' });

    const { rows } = await pool.query(
      'SELECT id, name FROM subcategory WHERE category_id = $1 ORDER BY name ASC',
      [idNum]
    );
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania podkategorii:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

// Przypisz do zalogowanego użytkownika
router.post('/', authRequired, async (req, res) => {
  const {
    title,
    description,
    location,
    status_id,
    type_id,
    category_id,
    subcategory_id
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Tytul i opis wymagane!' });
  }
  if (!category_id) {
    return res.status(400).json({ error: 'Kategoria wymagana (category_id)!' });
  }
  if (!subcategory_id) {
    return res.status(400).json({ error: 'Podkategoria wymagana (subcategory_id)!' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO listing (title, description, location, status_id, type_id, category_id, subcategory_id, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [title, description, location, status_id, type_id, category_id, subcategory_id || null, req.user.id]
    );

    res.status(201).json({ message: 'Ogloszenie stworzone', listing: result.rows[0] });
  } catch (err) {
    console.error('Blad podczas dodawania ogloszenia', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});


router.get('/', async (req, res) => {
  try {
    const { type_id, category_id, subcategory_id, category } = req.query;

    const where = [];
    const params = [];

    if (type_id) {
      const v = Number(type_id);
      if (Number.isNaN(v)) return res.status(400).json({ error: 'Nieprawidlowe type_id' });
      params.push(v);
      where.push(`l.type_id = $${params.length}`);
    }
    if (category_id) {
      const v = Number(category_id);
      if (Number.isNaN(v)) return res.status(400).json({ error: 'Nieprawidlowe category_id' });
      params.push(v);
      where.push(`l.category_id = $${params.length}`);
    }
    if (subcategory_id) {
      const v = Number(subcategory_id);
      if (Number.isNaN(v)) return res.status(400).json({ error: 'Nieprawidlowe subcategory_id' });
      params.push(v);
      where.push(`l.subcategory_id = $${params.length}`);
    }
    if (category) {
      params.push(String(category).toLowerCase());
      where.push(`l.category_id IN (SELECT id FROM category WHERE LOWER(name) = $${params.length})`);
    }

    const sql = `
      SELECT
        l.*,
        u.username AS author_username
      FROM listing l
      JOIN "user" u ON u.id = l.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY l.created_at DESC
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania ofert:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

router.get('/my', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, u.username AS author_username
       FROM listing l
       JOIN "user" u ON u.id = l.user_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania moich ogloszen:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});


router.get('/user/:id', async (req, res) => {
  const uid = Number(req.params.id);
  if (Number.isNaN(uid)) return res.status(400).json({ error: 'Nieprawidlowe id' });

  try {
    const { rows } = await pool.query(
      `SELECT l.*, u.username AS author_username
       FROM listing l
       JOIN "user" u ON u.id = l.user_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error('Blad podczas pobierania ogloszen uzytkownika:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});

// --- DELETE ---
router.delete('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    const del = await pool.query(
      `DELETE FROM listing WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id]
    );
    if (del.rowCount === 0) return res.status(404).json({ error: 'Ogłoszenie nie istnieje lub nie jest Twoje' });
    res.json({ message: 'Ogloszenie usuniete', deleted: del.rows[0] });
  } catch (err) {
    console.error('Blad podczas usuwania ogloszenia:', err.message);
    res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
  }
});


router.put('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { title, description, location, category_id, subcategory_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE listing 
       SET title = $1,
           description = $2,
           location = $3,
           category_id = COALESCE($4, category_id),
           subcategory_id = COALESCE($6, subcategory_id)
       WHERE id = $5 AND user_id = $7
       RETURNING *`,
      [title, description, location, category_id || null, id, subcategory_id || null, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ogłoszenie nie istnieje lub nie jest Twoje' });
    }
    res.json({ message: 'Ogłoszenie zaktualizowane', updated: result.rows[0] });
  } catch (err) {
    console.error('Błąd podczas edycji ogłoszenia', err.message);
    res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
  }
});

module.exports = router;