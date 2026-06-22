const axios = require('axios');
const pool = require('../config/db');

async function checkDatabase() {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    return { status: 'up', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'down', error: err.message };
  }
}

async function checkFlaskAI() {
  try {
    const start = Date.now();
    const response = await axios.get(`${process.env.FLASK_AI_URL}/health`, {
      timeout: 3000, // évite que Node attende indéfiniment si Flask est down
    });
    return {
      status: response.status === 200 ? 'up' : 'degraded',
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return { status: 'down', error: err.message };
  }
}

async function getSystemHealth() {
  const [db, ai] = await Promise.all([checkDatabase(), checkFlaskAI()]);

  const overall =
    db.status === 'up' && ai.status === 'up' ? 'healthy'
    : db.status === 'down' ? 'critical'  // sans DB, rien ne fonctionne
    : 'degraded';                         // DB ok mais IA down = dégradé, pas critique

  return {
    overall,
    components: {
      node_api: { status: 'up' },
      database: db,
      flask_ai: ai,
    },
    checked_at: new Date().toISOString(),
  };
}

module.exports = { getSystemHealth };