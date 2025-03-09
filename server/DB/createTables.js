const dotenv = require("dotenv")
dotenv.config()

const { Pool } = require('pg');

const pool = new Pool({
  connectionString:`postgresql://postgres.yehtchekqvcjteijqojt:${process.env.PG_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

const createTablesQuery = `
-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    runners JSONB NOT NULL,
    confidence_score NUMERIC,
    badges TEXT[] NOT NULL DEFAULT '{}'
);

-- Create runners table
CREATE TABLE IF NOT EXISTS runners (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    logouri TEXT,
    symbol TEXT NOT NULL,
    timestamps JSONB NOT NULL,
    athprice NUMERIC NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE 
);

-- Create filtered table
CREATE TABLE IF NOT EXISTS filtered (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE
);
`;

async function setUpDb(){
  await pool.query(createTablesQuery)
    .then(() => {
      console.log('Tables created successfully.');
    }).finally(()=>{
      pool.end()
    })
    .catch(err => {
      console.error('Error creating tables:', err);
    })
    
}

module.exports = setUpDb;