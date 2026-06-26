// frontend/src/pages/Servers.jsx
import { useMetricsSocket } from '../hooks/useMetricsSocket';

function StatusBadge({ status, isAnomaly }) {
  const color = isAnomaly ? '#f44747' : status === 'healthy' ? '#4ec9b0' : '#ce9178';
  return (
    <span style={{
      backgroundColor: color, color: '#1e1e1e', padding: '2px 10px',
      borderRadius: 12, fontSize: 12, fontWeight: 'bold',
    }}>
      {isAnomaly ? 'ANOMALIE' : status?.toUpperCase()}
    </span>
  );
}

export default function Servers() {
  const metrics = useMetricsSocket(); // tableau de serveurs

  if (!metrics) return <p>Connexion en cours...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>État des serveurs</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
            <th>Serveur</th>
            <th>Statut</th>
            <th>Requêtes</th>
            <th>Latence (ms)</th>
            <th>Erreurs 5xx</th>
            <th>Score anomalie</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((server) => (
            <tr key={server.server_id} style={{ borderBottom: '1px solid #333' }}>
              <td>Serveur {server.server_id}</td>
              <td><StatusBadge status={server.status} isAnomaly={server.is_anomaly} /></td>
              <td>{server.request_count}</td>
              <td>{server.avg_response_time?.toFixed(1)}</td>
              <td>{(server.error_rate_5xx * 100).toFixed(2)}%</td>
              <td>{server.anomaly_score?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}