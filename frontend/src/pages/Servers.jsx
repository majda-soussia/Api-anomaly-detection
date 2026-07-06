import { useMetricsSocket } from '../hooks/useSocket';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SkeletonRow } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/StateViews';

function StatusBadge({ status, isAnomaly }) {
  if (isAnomaly) return <Badge tone="critical" dot>Anomalie</Badge>;
  if (status === 'healthy') return <Badge tone="success">Healthy</Badge>;
  return <Badge tone="warning">{status?.toUpperCase() || 'Unknown'}</Badge>;
}

export default function Servers() {
  const { metrics } = useMetricsSocket();

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>État des serveurs</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Snapshot en temps réel de chaque serveur surveillé.</p>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'var(--bg-surface-raised)' }}>
              <Th>Serveur</Th>
              <Th>Statut</Th>
              <Th>Requêtes</Th>
              <Th>Latence (ms)</Th>
              <Th>Erreurs 5xx</Th>
              <Th>Score anomalie</Th>
            </tr>
          </thead>
          <tbody>
            {!metrics && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} columns={6} />)}
            {metrics &&
              metrics.map((server) => (
                <tr key={server.server_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>Serveur {server.server_id}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={server.status} isAnomaly={server.is_anomaly} />
                  </td>
                  <td className="mono" style={{ padding: '10px 12px' }}>{server.request_count}</td>
                  <td className="mono" style={{ padding: '10px 12px' }}>{server.avg_response_time?.toFixed(1)}</td>
                  <td className="mono" style={{ padding: '10px 12px' }}>{(server.error_rate_5xx * 100).toFixed(2)}%</td>
                  <td className="mono" style={{ padding: '10px 12px' }}>{server.anomaly_score?.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {metrics && metrics.length === 0 && <EmptyState title="Aucun serveur détecté" description="Vérifiez que le pipeline de métriques est actif." />}
      </Card>
    </div>
  );
}

function Th({ children }) {
  return <th style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{children}</th>;
}
