const pool = require('../config/db');
let rowsByServer = null;     
let cursorByServer = null;  
async function loadDataIfNeeded() {
  if (rowsByServer) return;

  const { rows } = await pool.query(`
    SELECT
      server_id,
      timestamp,
      request_count,
      unique_ips,
      avg_response_time,
      error_rate_5xx,
      anomaly_score,
      is_anomaly,
      status
    FROM test_predictions
    ORDER BY server_id ASC, timestamp ASC;
  `);

  rowsByServer = {};
  cursorByServer = {};

  for (const row of rows) {
    const id = row.server_id;
    if (!rowsByServer[id]) {
      rowsByServer[id] = [];
      cursorByServer[id] = 0;
    }
    rowsByServer[id].push(row);
  }

  const serverIds = Object.keys(rowsByServer);
  console.log(
    `[MetricsService] Données chargées pour ${serverIds.length} serveur(s) : ` +
    serverIds.map((id) => `server ${id} (${rowsByServer[id].length} lignes)`).join(', ')
  );
}

/**
 * Renvoie UNE ligne par serveur (l'état courant du curseur de chacun),
 * puis avance chaque curseur d'un pas. Boucle automatiquement par serveur.
 */
async function getLatestMetrics() {
  await loadDataIfNeeded();

  const serverIds = Object.keys(rowsByServer);
  if (serverIds.length === 0) return [];

  const result = serverIds.map((id) => {
    const rows = rowsByServer[id];
    const idx = cursorByServer[id];
    const currentRow = rows[idx];

    // Avance le curseur de CE serveur, boucle à 0 s'il atteint la fin
    cursorByServer[id] = (idx + 1) % rows.length;

    return currentRow;
  });

  return result;
}

/**
 * Historique : on garde les N derniers pas déjà "joués" pour CHAQUE serveur,
 * dans son propre référentiel de curseur (pas une fenêtre temporelle réelle,
 * puisque les timestamps du dataset ne sont pas liés à l'heure actuelle).
 */
async function getMetricsHistory(limitSteps = 50) {
  await loadDataIfNeeded();

  const serverIds = Object.keys(rowsByServer);
  if (serverIds.length === 0) return [];

  let result = [];
  for (const id of serverIds) {
    const rows = rowsByServer[id];
    const idx = cursorByServer[id];
    const start = Math.max(0, idx - limitSteps);
    result = result.concat(rows.slice(start, idx));
  }

  // Trie par timestamp pour un affichage chronologique cohérent
  result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return result;
}

module.exports = { getLatestMetrics, getMetricsHistory };