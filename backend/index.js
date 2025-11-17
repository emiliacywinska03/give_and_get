require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./db');

const listingRoutes = require('./routes/listing');
const authRoutes = require('./routes/auth');
const rewardsRouter = require('./routes/rewards');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  'http://localhost:5173',
  'http://172.21.40.162:3000',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); 
    return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked'));
  },
  credentials: true,
}));


app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

app.get('/healthz', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, time: result.rows[0].now });
  } catch (err) {
    console.error('Błąd połączenia z bazą:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.use('/api/listings', listingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rewards', rewardsRouter);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend działa na porcie: ${PORT}`);
});