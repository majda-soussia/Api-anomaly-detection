import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMetricsSocket } from '../hooks/useSocket';
import Card from '../components/ui/Card';
import { EmptyState } from '../components/ui/StateViews';

const MAX_POINTS = 30;
const RESOLVED_COLORS = ['#5b8def', '#22c55e', '#f59e0b', '#c586c0', '#8ec8ff'];

export default function Overview() {
  const { metrics } = useMetricsSocket();
  const [history, setHistory] = useState([]);
  const [serverIds, setServerIds] = useState([]);

  useEffect(() => {
    if (!metrics || metrics.length === 0) return;

    const time = new Date().toLocaleTimeString();
    const point = { time };
    metrics.forEach((server) => {
      point[`rps_${server.server_id}`] = server.request_count;
      point[`latency_${server.server_id}`] = server.avg_response_time;
    });

    setHistory((prev) => [...prev, point].slice(-MAX_POINTS));

    // IMPORTANT : on ne réduit jamais la liste des serverIds connus (voir
    // note originale) — garde-fou pour ne jamais perdre une courbe.
    setServerIds((prev) => {
      const incoming = metrics.map((s) => s.server_id);
      const merged = Array.from(new Set([...prev, ...incoming]));
      merged.sort((a, b) => a - b);
      return merged;
    });
  }, [metrics]);

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Overview</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Latence et trafic en temps réel, tous serveurs.</p>
      </div>

      {!metrics ? (
        <Card style={{ padding: 0 }}>
          <EmptyState title="Connexion au serveur en cours…" description="En attente du premier tick de métriques." />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <ChartCard title="Latence moyenne par serveur (ms)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <YAxis domain={[0, 1500]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {serverIds.map((id, index) => (
                  <Line
                    key={id}
                    type="linear"
                    dataKey={`latency_${id}`}
                    name={`Serveur ${id}`}
                    stroke={RESOLVED_COLORS[index % RESOLVED_COLORS.length]}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Requêtes (RPS) par serveur">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <YAxis domain={[0, 'auto']} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {serverIds.map((id, index) => (
                  <Line
                    key={id}
                    type="linear"
                    dataKey={`rps_${id}`}
                    name={`Serveur ${id}`}
                    stroke={RESOLVED_COLORS[index % RESOLVED_COLORS.length]}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

const tooltipStyle = { background: 'var(--bg-surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 };

function ChartCard({ title, children }) {
  return (
    <Card style={{ padding: 'var(--space-5)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {title}
      </h3>
      {children}
    </Card>
  );
}
