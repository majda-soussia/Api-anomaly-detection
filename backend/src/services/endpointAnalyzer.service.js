const db = require('../config/db');

const THRESHOLDS = {
  latencyRatio: 2,          // si un endpoint est 2 fois plus lent que d'habitude=  suspect.
  dosTrafficRatio: 5,       // 5x le rythme normal de requêtes sur CET endpoint = suspect
  serverTrafficRatio: 4.5,    // volume global du serveur inhabituel
};
const MIN_BASELINE_SAMPLES = 3; // il faut au moins 3 requêtes passées sur l'endpoint pour juger s'il est "anormal"
const MIN_CONFIDENCE_TO_REPORT = 40;

/**
 * Baseline par endpoint (path+method), calculée sur tout l'historique
 */
async function computeBaseline(serverId, windowStart, windowEnd) {
  const { rows } = await db.query(
    `SELECT
       path,
       method,
       COUNT(*)::float AS total_requests,
       AVG(response_time_ms) AS avg_response,
       MIN(timestamp) AS baseline_min_ts,
       MAX(timestamp) AS baseline_max_ts
     FROM access_logs
     WHERE server_id = $1
       AND (timestamp < $2 OR timestamp > $3)
     GROUP BY path, method`,
    [serverId, windowStart, windowEnd]
  );
  return rows;
}

/**
 * Baseline au niveau du serveur entier (tous endpoints confondus),
 * pour détecter un pic de volume global plutôt qu'un flood sur un endpoint précis.
 */
async function computeServerBaseline(serverId, windowStart, windowEnd) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::float AS total_requests,
            MIN(timestamp) AS baseline_min_ts,
            MAX(timestamp) AS baseline_max_ts
     FROM access_logs
     WHERE server_id = $1 AND (timestamp < $2 OR timestamp > $3)`,
    [serverId, windowStart, windowEnd]
  );
  return rows[0];
}

/**
 * La/les requête(s) réelle(s) qui ont eu lieu au moment de l'alerte.
 */
async function computeCurrentRequests(serverId, windowStart, windowEnd) {
  const { rows } = await db.query(
    `SELECT path, method, status_code, response_time_ms, timestamp
     FROM access_logs
     WHERE server_id = $1 AND timestamp BETWEEN $2 AND $3
     ORDER BY timestamp ASC`,
    [serverId, windowStart, windowEnd]
  );
  return rows;
}

async function analyzeEndpoints(serverId, windowStart, windowEnd) {
  const [baseline, currentRequests, serverBaseline] = await Promise.all([ /*On lance les trois requêtes SQL en parallèle. */
    computeBaseline(serverId, windowStart, windowEnd),
    computeCurrentRequests(serverId, windowStart, windowEnd),
    computeServerBaseline(serverId, windowStart, windowEnd),
  ]);

  if (currentRequests.length === 0) {
    return { root_cause: null, reason: [], endpoints_analyzed: [] };
  }

  const baselineByKey = new Map(baseline.map((b) => [`${b.path}::${b.method}`, b]));
  const windowMs = windowEnd.getTime() - windowStart.getTime();

  // --- 1. Analyse par requête individuelle (latence / erreur) ---
  const perRequestAnalysis = currentRequests.map((req) => {
    const key = `${req.path}::${req.method}`;
    const base = baselineByKey.get(key);
    const isServerError = req.status_code >= 500;
    const reasons = [];
    let score = 0;

    if (!base || base.total_requests < MIN_BASELINE_SAMPLES) {
      if (isServerError) {
        reasons.push('HTTP 500 error (endpoint sans historique suffisant)');
        score = 50;
      }
      return {
        path: req.path,
        method: req.method,
        response_time: req.response_time_ms,
        status_code: req.status_code,
        score,
        reasons,
      };
    }

    const latencyRatio = req.response_time_ms / Math.max(base.avg_response, 1);
    if (isServerError) {
      reasons.push('HTTP 500 error');
      score += 60;
    }
    if (latencyRatio >= THRESHOLDS.latencyRatio) {
      reasons.push(`Temps de réponse ${latencyRatio.toFixed(1)}x au-dessus de la normale de cet endpoint`);
      score += 40 * Math.min(latencyRatio / THRESHOLDS.latencyRatio, 2);
    }

    return {
      path: req.path,
      method: req.method,
      response_time: req.response_time_ms,
      baseline_avg_response: Math.round(base.avg_response),
      status_code: req.status_code,
      score: Math.round(score),
      reasons,
    };
  });

  // --- 2. Analyse par volume groupé sur un même endpoint (DoS potentiel) ---
  const requestsByEndpoint = new Map();
  for (const req of currentRequests) {
    const key = `${req.path}::${req.method}`;
    if (!requestsByEndpoint.has(key)) requestsByEndpoint.set(key, []);
    requestsByEndpoint.get(key).push(req);
  }

  const dosAnalysis = [];
  for (const [key, reqs] of requestsByEndpoint) {
    const base = baselineByKey.get(key);
    if (!base || base.total_requests < MIN_BASELINE_SAMPLES) continue;

    const baselineSpanMs = new Date(base.baseline_max_ts).getTime() - new Date(base.baseline_min_ts).getTime();
    const expectedPerWindow = baselineSpanMs > 0
      ? Math.max(base.total_requests * (windowMs / baselineSpanMs), 0.1)
      : 0.1; // un seul point d'historique -> span nul, on tombe sur le minimum par défaut
    const trafficRatio = reqs.length / expectedPerWindow;

    if (reqs.length >= 3 && trafficRatio >= THRESHOLDS.dosTrafficRatio) {
      const [path, method] = key.split('::');
      dosAnalysis.push({
        path,
        method,
        request_count_in_window: reqs.length,
        expected_normal: Math.round(expectedPerWindow * 100) / 100,
        score: Math.round(70 * Math.min(trafficRatio / THRESHOLDS.dosTrafficRatio, 1.5)),
        reasons: [`Possible attaque DoS : ${reqs.length} requêtes sur cet endpoint en ${Math.round(windowMs / 60000)} min (normale ~${expectedPerWindow.toFixed(1)})`],
      });
    }
  }

  // --- 3. Analyse de volume global au niveau serveur (plusieurs endpoints différents touchés) ---
  const serverTrafficAnalysis = [];
  if (serverBaseline && serverBaseline.total_requests >= MIN_BASELINE_SAMPLES) {
    const spanMs = new Date(serverBaseline.baseline_max_ts).getTime() - new Date(serverBaseline.baseline_min_ts).getTime();
    const expectedPerWindow = spanMs > 0
      ? Math.max(serverBaseline.total_requests * (windowMs / spanMs), 0.1)
      : 0.1;
    const ratio = currentRequests.length / expectedPerWindow;

    if (currentRequests.length >= 2 && ratio >= THRESHOLDS.serverTrafficRatio) {
      // Pas d'endpoint unique désigné coupable — on pointe le plus "rare" historiquement
      const rarest = currentRequests
        .map((req) => {
          const b = baselineByKey.get(`${req.path}::${req.method}`);
          return { req, historical: b ? b.total_requests : 0 };
        })
        .sort((a, b) => a.historical - b.historical)[0].req;

      serverTrafficAnalysis.push({
        path: rarest.path,
        method: rarest.method,
        score: Math.round(55 * Math.min(ratio / THRESHOLDS.serverTrafficRatio, 1.5)),
        reasons: [
          `Volume de trafic inhabituel sur le serveur : ${currentRequests.length} requêtes en ${Math.round(windowMs / 60000)} min sur ${new Set(currentRequests.map((r) => r.path)).size} endpoints différents (normale ~${expectedPerWindow.toFixed(1)} requêtes)`,
        ],
      });
    }
  }

  const analyzed = [...perRequestAnalysis, ...dosAnalysis, ...serverTrafficAnalysis].sort((a, b) => b.score - a.score);
  const worst = analyzed[0];
  const rootCause = worst && worst.score >= MIN_CONFIDENCE_TO_REPORT
    ? { endpoint: worst.path, method: worst.method, confidence: Math.min(worst.score, 99) }
    : null;

  return {
    root_cause: rootCause,
    reason: rootCause ? worst.reasons : [],
    endpoints_analyzed: analyzed,
  };
}

module.exports = { analyzeEndpoints };