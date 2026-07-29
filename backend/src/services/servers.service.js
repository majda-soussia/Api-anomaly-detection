const db = require('../config/db');

async function listServers() {
  const { rows } = await db.query(
    `SELECT id, name, environment, is_active, created_at
     FROM servers
     ORDER BY id ASC;`
  );
  return rows;
}

async function createServer({ name, environment }) {
  const { rows } = await db.query(
    `INSERT INTO servers (name, environment, is_active)
     VALUES ($1, $2, true)
     RETURNING id, name, environment, is_active, created_at;`,
    [name, environment]
  );
  return rows[0];
}

async function deactivateServer(id) {
  const { rows } = await db.query(
    `UPDATE servers
     SET is_active = false
     WHERE id = $1
     RETURNING id, name, environment, is_active, created_at;`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { listServers, createServer, deactivateServer };