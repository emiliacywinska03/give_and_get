require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');         
const { pool } = require('./db');
const listingRoutes = require('./routes/listing');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,    
}));
app.use(express.json());
app.use('/api/listings', listingRoutes);

app.get('/', async (req, res) => {
  console.log('Dostalem zapytanie');
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(result);
    res.json({ message: 'Udalo sie', czas: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad', szczegoly: err.message });
  }
});


app.listen(PORT, '0.0.0.0' , ()=>{
    console.log(`Backend dziala na porcie: ${PORT}`);
});

