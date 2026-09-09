const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = { client, DB_URL };
