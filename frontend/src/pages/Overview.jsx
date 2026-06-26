// frontend/src/pages/Overview.jsx
import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useMetricsSocket } from '../hooks/useMetricsSocket';

const MAX_POINTS = 30;

// Palette de couleurs pour différencier les serveurs sur le graphe
const COLORS = ['#4ec9b0', '#569cd6', '#ce9178', '#c586c0', '#dcdcaa'];

export default function Overview() {
  const metrics = useMetricsSocket(); // tableau de serveurs à chaque tick
  const [history, setHistory] = useState([]);
  const [serverIds, setServerIds] = useState([]);

  useEffect(() => {
    if (!metrics || metrics.length === 0) return;

    const time = new Date().toLocaleTimeString();

    // On construit UN point qui contient les valeurs de TOUS les serveurs
    const point = { time };
    metrics.forEach((server) => {
      point[`rps_${server.server_id}`] = server.request_count;
      point[`latency_${server.server_id}`] = server.avg_response_time;
    });

    setHistory((prev) => [...prev, point].slice(-MAX_POINTS));

    // IMPORTANT : on ne réduit jamais la liste des serverIds connus,
    // on l'étend seulement — sinon une ligne disparaît dès qu'un tick
    // n'a temporairement pas ramené ce serveur (cas désormais rare
    // avec le curseur par serveur côté backend, mais on garde ce
    // garde-fou pour ne plus jamais perdre une courbe à l'affichage).
    setServerIds((prev) => {
      const incoming = metrics.map((s) => s.server_id);
      const merged = Array.from(new Set([...prev, ...incoming]));
      merged.sort((a, b) => a - b);
      return merged;
    });
  }, [metrics]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Overview</h2>

      {!metrics && <p>Connexion au serveur en cours...</p>}

      <h3>Latence moyenne par serveur (ms)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          {/* domaine fixe : évite que l'axe Y change brutalement d'échelle
              à chaque tick (200 -> 1400 -> 200), ce qui donnait l'impression
              de courbes qui "débordent" du cadre */}
          <YAxis domain={[0, 1500]} />
          <Tooltip />
          <Legend />
          {serverIds.map((id, index) => (
            <Line
              key={id}
              type="linear"            /* segments droits entre vraies valeurs, pas de lissage qui déborde */
              dataKey={`latency_${id}`}
              name={`Serveur ${id}`}
              stroke={COLORS[index % COLORS.length]}
              dot={false}
              connectNulls            /* relie les points même si un serveur manque un tick ponctuel */
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <h3>Requêtes (RPS) par serveur</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 'auto']} allowDecimals={false} />
          <Tooltip />
          <Legend />
          {serverIds.map((id, index) => (
            <Line
              key={id}
              type="linear"
              dataKey={`rps_${id}`}
              name={`Serveur ${id}`}
              stroke={COLORS[index % COLORS.length]}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}