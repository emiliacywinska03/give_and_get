const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

// auth middleware
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

// generator kodów typu ABCD-1234
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result.slice(0, 4) + '-' + result.slice(4);
}


//GET /api/rewards/catalog – lista dostępnych nagród
router.get('/catalog', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reward_catalog ORDER BY points_cost ASC');
    res.json({ ok: true, rewards: rows });
  } catch (err) {
    console.error('Błąd katalogu nagród:', err);
    res.status(500).json({ ok: false, message: 'Błąd serwera' });
  }
});


//POST /api/rewards/redeem/:catalogId – wymiana punktów
router.post('/redeem/:catalogId', authRequired, async (req, res) => {
  const catalogId = Number(req.params.catalogId);

  if (isNaN(catalogId)) {
    return res.status(400).json({ ok: false, message: 'Nieprawidłowe ID nagrody' });
  }

  try {
    // pobierz nagrodę z katalogu
    const rewardQuery = await pool.query(
      'SELECT * FROM reward_catalog WHERE id = $1',
      [catalogId]
    );

    if (!rewardQuery.rows[0]) {
      return res.status(404).json({ ok: false, message: 'Nagroda nie istnieje' });
    }

    const reward = rewardQuery.rows[0];

    // pobierz punkty użytkownika
    const userQuery = await pool.query(
      `SELECT points FROM "user" WHERE id = $1`,
      [req.user.id]
    );
    const userPoints = userQuery.rows[0].points;

    if (userPoints < reward.points_cost) {
      return res.status(400).json({
        ok: false,
        message: `Masz tylko ${userPoints} punktów. Potrzeba ${reward.points_cost}.`,
      });
    }

    // odejmij punkty
    const updateUser = await pool.query(
      `UPDATE "user" SET points = points - $1 WHERE id = $2 RETURNING points`,
      [reward.points_cost, req.user.id]
    );

    const updatedPoints = updateUser.rows[0].points;

    // wygeneruj kod
    const code = generateCode();

    await pool.query(
      `INSERT INTO reward_code (user_id, catalog_id, code)
       VALUES ($1, $2, $3)`,
      [req.user.id, catalogId, code]
    );

    return res.json({
      ok: true,
      code,
      brand: reward.brand,
      percent: reward.percent,
      userPoints: updatedPoints,
    });

  } catch (err) {
    console.error('Błąd wymiany punktów:', err);
    res.status(500).json({ ok: false, message: 'Błąd serwera' });
  }
});

module.exports = router;
