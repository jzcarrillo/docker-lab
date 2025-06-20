const { Pool } = require('pg');

const pool = new Pool({
  host: 'db',         // Docker service name
  user: 'user',
  password: 'pass',
  database: 'mydb',
  port: 5432,
});

module.exports = pool;
