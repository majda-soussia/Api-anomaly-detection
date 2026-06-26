// test-db.js
const pool = require('./src/config/db');

(async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(result.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();