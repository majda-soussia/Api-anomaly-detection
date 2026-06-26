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
    // ex: { time, "rps_1": 142, "rps_2": 98, "latency_1": 87.5, "latency_2": 120.3 }
    const point = { time };
    metrics.forEach((server) => {
      point[`rps_${server.server_id}`] = server.request_count;
      point[`latency_${server.server_id}`] = server.avg_response_time;
    });

    setHistory((prev) => [...prev, point].slice(-MAX_POINTS));
    setServerIds(metrics.map((s) => s.server_id));
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
          <YAxis />
          <Tooltip />
          <Legend />
          {serverIds.map((id, index) => (
            <Line
              key={id}
              type="monotone"
              dataKey={`latency_${id}`}
              name={`Serveur ${id}`}
              stroke={COLORS[index % COLORS.length]}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <h3>Requêtes (RPS) par serveur</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          {serverIds.map((id, index) => (
            <Line
              key={id}
              type="monotone"
              dataKey={`rps_${id}`}
              name={`Serveur ${id}`}
              stroke={COLORS[index % COLORS.length]}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}