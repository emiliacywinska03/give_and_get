const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
    const {
        title,
        description,
        location,
        status_id,
        type_id,
        category_id,
        user_id
    } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: 'Tytul i opis wymagane!'});
    }

    try {
        const result = await pool.query(
            `INSERT INTO listing ( title, description, location, status_id, type_id, category_id, user_id )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
             [title, description, location, status_id, type_id, category_id, user_id]
        );

        res.status(201).json({ message: 'Ogloszenie stworzone', listing: result.rows[0] });
    } catch (err) {
        console.error('Blad podczas dodawania ogloszenia', err.message);
        res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM listing ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Blad podczas pobierania ofert:', err.message);
        res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
    }
});

module.exports = router;