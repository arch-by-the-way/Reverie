const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// TODO Day 2: CRUD helpers for `pages` (SELECT/INSERT), wired into /check
// TODO Day 3: atomic ON CONFLICT / conditional UPDATE for the RC-fix

module.exports = { pool };