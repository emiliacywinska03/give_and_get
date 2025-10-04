const express = require('express');
const {pool}= require('../db');

const router = express.Router();

router.get('/questions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, text
       FROM security_question
       WHERE active = TRUE AND locale = 'pl'
       ORDER BY sort_order, id`
    );

    res.json({ ok: true, questions: rows });
  } catch (err) {
    console.error('Błąd przy pobieraniu pytań:', err);
    res.status(500).json({ ok: false, error: 'Błąd serwera przy pobieraniu pytań' });
  }
});

module.exports = router;