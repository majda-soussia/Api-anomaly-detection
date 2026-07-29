const db = require('../config/db');

let rowsByServer = null;
let cursorByServer = null;
let historicalPool = null; // toutes les lignes confondues, sert à synthétiser

let registeredServerIds = null; // ids actifs lus depuis la table `servers`
let lastServersRefresh = 0;
const SERVERS_REFRESH_INTERVAL_MS = 5000; // pas besoin de relire à chaque tick (2s)

async function loadDataIfNeeded() {
  if (rowsByServer) return;

  const { rows } = await db.query(`
    SELECT *
    FROM test_predictions
    ORDER BY server_id ASC, timestamp ASC;
  `);

  rowsByServer = {};
  cursorByServer = {};
  historicalPool = rows;

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
 * Relit la liste des serveurs actifs depuis la table `servers` (throttlé,
 * puisque l'emitter appelle getLatestMetrics() toutes les 2s).
 */
async function refreshRegisteredServersIfNeeded() {
  const now = Date.now();
  if (registeredServerIds && now - lastServersRefresh < SERVERS_REFRESH_INTERVAL_MS) return;

  const { rows } = await db.query(
    `SELECT id FROM servers WHERE is_active = true ORDER BY id ASC;`
  );
  registeredServerIds = rows.map((r) => r.id);
  lastServersRefresh = now;
}

/**
 * Un serveur ajouté manuellement n'a pas de vraies lignes dans test_predictions.
 * On pioche une ligne au hasard dans l'historique global et on l'adapte :
 * nouveau server_id, timestamp courant, et un bruit +/-10% sur les métriques
 * numériques pour que ça ne soit pas un miroir exact d'un serveur existant.
 */
function synthesizeRowForServer(serverId) {
  const template = historicalPool[Math.floor(Math.random() * historicalPool.length)];
  const noise = () => 1 + (Math.random() - 0.5) * 0.2;

  return {
    ...template,
    server_id: serverId,
    timestamp: new Date().toISOString(),
    request_count: Math.max(0, Math.round(template.request_count * noise())),
    avg_response_time: +(template.avg_response_time * noise()).toFixed(2),
    error_rate_5xx: Math.max(0, +(template.error_rate_5xx * noise()).toFixed(4)),
  };
}

/**
 * Renvoie UNE ligne par serveur actif (registre `servers`).
 * - Serveur "réel" (présent dans test_predictions) : curseur qui avance, comme avant.
 * - Serveur ajouté manuellement : ligne synthétisée à la volée.
 */
async function getLatestMetrics() {
  await loadDataIfNeeded();
  await refreshRegisteredServersIfNeeded();

  const realServerIds = Object.keys(rowsByServer).map(Number);
  const allServerIds = Array.from(new Set([...realServerIds, ...registeredServerIds]));

  if (allServerIds.length === 0) return [];

  const result = allServerIds.map((id) => {
    if (rowsByServer[id]) {
      const rows = rowsByServer[id];
      const idx = cursorByServer[id];
      const currentRow = rows[idx];
      cursorByServer[id] = (idx + 1) % rows.length;
      return currentRow;
    }
    return synthesizeRowForServer(id);
  });

  return result;
}

/**
 * Historique : uniquement pour les serveurs "réels" (curseur rejouable).
 * Pour un serveur synthétique, il n'y a pas d'historique persistant à
 * proprement parler puisque chaque tick est généré à la volée — on renvoie
 * simplement ce qu'on a pour les serveurs réels, comme avant.
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

  result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return result;
}

module.exports = { getLatestMetrics, getMetricsHistory };