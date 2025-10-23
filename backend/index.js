require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./db');

const listingRoutes = require('./routes/listing');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5050;


app.use(cors({
  origin: 'http://172.21.40.162:3000',
  credentials: true,                 
}));


app.use(express.json());
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


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend działa na porcie: ${PORT}`);
});