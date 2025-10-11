const express = require('express');
const router = express.Router();
const { pool } = require('../db');

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


//USUWANIE OGLOSZENIA
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM listing WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ogloszenie nie istnieje'});
        }

        res.json({ message: 'Ogloszenie usuniete', deletes: result.rows[0] });
    } catch (err) {
        console.error('Blad podczas usuwania ogloszenia:', err.message);
        res.status(500).json({ error: 'Blad wewnetrzny', details: err.message });
    }
})


//EDYCJA OGLOSZENIA
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, location } = req.body;

    try {
        const result = await pool.query(
            `UPDATE listing 
             SET title = $1,
                 description = $2,
                 location = $3
             WHERE id = $4
             RETURNING *`,
            [title, description, location, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ogłoszenie nie istnieje' });
        }

        res.json({ message: 'Ogłoszenie zaktualizowane', updated: result.rows[0] });
    } catch (err) {
        console.error('Błąd podczas edycji ogłoszenia', err.message);
        res.status(500).json({ error: 'Błąd wewnętrzny', details: err.message });
    }
});

    


module.exports = router;
