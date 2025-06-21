require('dotenv').config();
const express = require('express');
const cors= require('cors');
const{Pool}=require('pg');

const app=express();
const PORT = 5050;

const pool=new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

app.use(cors());
app.use(express.json());

app.get('/', async(req, res) => {
    console.log('Dostalem zapytanie')
    try{
        const result=await pool.query('SELECT NOW()');
        console.log(result);
        res.json({message: 'Udalo sie', czas: result.rows[0].now});
    }catch(err){
        console.error(err);
        res.status(500).json({error: 'Blad', szczegoly: err.message});
    }
});


app.listen(PORT, '0.0.0.0' , ()=>{
    console.log(`Backend dziala na porcie: ${PORT}`);
});