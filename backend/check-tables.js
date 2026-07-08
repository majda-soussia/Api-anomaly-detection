// check-tables.js
const pool = require('./src/config/db');

(async () => {
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    );
    console.log('Tables found:', result.rows);
  } catch (err) {
    console.error('DB ERROR:', err.message);
  } finally {
    process.exit(0);
  }
})();