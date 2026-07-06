import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api, ApiError } from '../lib/apiClient';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SignalBadge from '../components/ui/SignalBadge';
import { Select } from '../components/ui/FormControls';
import { SkeletonRow } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/StateViews';
import Modal from '../components/ui/Modal';
import VisibilityIcon from '@mui/icons-material/Visibility';

const PERIODS = [
  { label: '24h', hours: 24 },
  { label: '7j',  hours: 168 },
  { label: '30j', hours: 720 },
];

const num    = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmtMs  = (v) => (num(v) !== null ? num(v).toLocaleString('fr-FR') : '—');
const fmtPct = (v) => (num(v) !== null ? `${(num(v) * 100).toFixed(2)}%` : '—');

function groupByBucket(alerts, hours) {
  const now = Date.now();
  const buckets = {};
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now - i * 3600000);
    const key = hours <= 24
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (!buckets[key]) buckets[key] = { time: key, CRITICAL: 0, WARNING: 0 };
  }
  alerts.forEach((alert) => {
    const d = new Date(alert.created_at);
    const key = hours <= 24
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (buckets[key]) buckets[key][alert.decision] = (buckets[key][alert.decision] || 0) + 1;
  });
  return Object.values(buckets);
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function History() {
  const [period, setPeriod]   = useState(PERIODS[0]);
  const [decision, setDecision] = useState('');
  const [alerts, setAlerts]   = useState([]);
  const [mttr, setMttr]       = useState(null);
  const [status, setStatus]   = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [detailAlert, setDetailAlert] = useState(null);

  const range = useMemo(() => {
    const to   = new Date();
    const from = new Date(to.getTime() - period.hours * 3600000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period]);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      const [alertsRes, mttrRes] = await Promise.all([
        api.getAlerts({ ...range, decision: decision || undefined, sort: 'created_at', order: 'desc', limit: 500 }),
        api.getMttr({ ...range }),
      ]);
      setAlerts(alertsRes.data);
      setMttr(mttrRes.data.mttrSeconds);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof ApiError ? err.message : "Impossible de charger l'historique.");
    }
  }, [range, decision]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData     = useMemo(() => groupByBucket(alerts, period.hours), [alerts, period]);
  const criticalCount = alerts.filter((a) => a.decision === 'CRITICAL').length;
  const warningCount  = alerts.filter((a) => a.decision === 'WARNING').length;
  const ackCount      = alerts.filter((a) => a.status === 'acknowledged').length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Historique</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Tendance des alertes et temps de résolution.
        </p>
      </div>

      {/* Filtres */}
      <Card style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setPeriod(opt)}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 500,
                border: `1px solid ${period.label === opt.label ? 'var(--accent-border)' : 'var(--border-strong)'}`,
                background: period.label === opt.label ? 'var(--accent-soft)' : 'var(--bg-surface-raised)',
                color: period.label === opt.label ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Select
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          options={[
            { value: '',          label: 'Tous niveaux' },
            { value: 'CRITICAL',  label: 'CRITICAL' },
            { value: 'WARNING',   label: 'WARNING' },
          ]}
        />
      </Card>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <KpiCard label={`Total — ${period.label}`} value={alerts.length}  color="var(--accent)" />
        <KpiCard label="Critiques"                 value={criticalCount}   color="var(--critical)" />
        <KpiCard label="Warnings"                  value={warningCount}    color="var(--warning)" />
        <KpiCard label="Acquittées"                value={ackCount}        color="var(--success)" />
        <KpiCard label="MTTR"  value={formatDuration(mttr)}                color="var(--accent)" />
      </div>

      {/* Graphe distribution */}
      <Card style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Distribution — {period.label}
        </h3>
        {status === 'error' ? (
          <ErrorState message={errorMsg} onRetry={fetchData} />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="CRITICAL" fill="var(--critical)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="WARNING"  fill="var(--warning)"  radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tableau — mêmes colonnes que Alerts, sans bouton Acquitter */}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {alerts.length} alerte{alerts.length !== 1 ? 's' : ''}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'var(--bg-surface-raised)' }}>
              <Th>ID</Th>
              <Th>Niveau</Th>
              <Th>Serveur</Th>
              <Th>P95</Th>
              <Th>Moy.</Th>
              <Th>Erreurs 5xx</Th>
              <Th>Requêtes</Th>
              <Th>Signal (AE / IF)</Th>
              <Th>Confiance</Th>
              <Th>Statut</Th>
              <Th>Créée le</Th>
              <Th>Acquittée le</Th>
              <Th>Détail</Th>
            </tr>
          </thead>
          <tbody>
            {status === 'loading' && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} columns={13} />)}
            {status !== 'loading' && alerts.map((alert) => (
              <HistoryRow
                key={alert.id}
                alert={alert}
                onView={() => setDetailAlert(alert)}
              />
            ))}
          </tbody>
        </table>
        {status !== 'loading' && alerts.length === 0 && (
          <EmptyState
            title="Aucune alerte sur cette période"
            description="Élargissez la période ou changez de filtre."
          />
        )}
      </Card>

      <AlertDetailModal alert={detailAlert} onClose={() => setDetailAlert(null)} />
    </div>
  );
}

function HistoryRow({ alert, onView }) {
  const errRate = num(alert.error_rate_5xx);
  const p95     = num(alert.p95_response_time);

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <Td className="mono" muted>#{alert.id}</Td>
      <Td>
        <Badge tone={alert.decision === 'CRITICAL' ? 'critical' : 'warning'} dot>
          {alert.decision}
        </Badge>
      </Td>
      <Td strong>{alert.server_id || '—'}</Td>
      <Td className="mono" style={{ color: p95 !== null && p95 > 1000 ? 'var(--critical)' : undefined }}>
        {fmtMs(alert.p95_response_time)}
      </Td>
      <Td className="mono">{fmtMs(alert.avg_response_time)}</Td>
      <Td className="mono" style={{ color: errRate !== null && errRate > 0.05 ? 'var(--critical)' : undefined }}>
        {fmtPct(alert.error_rate_5xx)}
      </Td>
      <Td className="mono">{num(alert.request_count) ?? '—'}</Td>
      <Td>
        <div style={{ display: 'flex', gap: 4 }}>
          <SignalBadge label="AE" flagged={alert.autoencoder_flag} score={num(alert.autoencoder_score)} />
          <SignalBadge label="IF" flagged={alert.isolation_forest_flag} score={num(alert.isolation_forest_score)} />
        </div>
      </Td>
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono" style={{ fontSize: 12, minWidth: 32 }}>
            {num(alert.confidence) !== null ? `${(num(alert.confidence) * 100).toFixed(0)}%` : '—'}
          </span>
          <div style={{ width: 44, height: 4, borderRadius: 2, background: 'var(--bg-canvas)', overflow: 'hidden' }}>
            <div style={{
              width: `${(num(alert.confidence) ?? 0) * 100}%`,
              height: '100%',
              background: alert.decision === 'CRITICAL' ? 'var(--critical)' : 'var(--warning)',
              borderRadius: 2,
            }} />
          </div>
        </div>
      </Td>
      <Td>
        <Badge tone={alert.status === 'active' ? 'success' : 'neutral'}>
          {alert.status === 'active' ? 'Active' : 'Acquittée'}
        </Badge>
      </Td>
      <Td muted style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        {new Date(alert.created_at).toLocaleString('fr-FR')}
      </Td>
      <Td muted style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        {alert.acknowledged_at ? new Date(alert.acknowledged_at).toLocaleString('fr-FR') : '—'}
      </Td>
      <Td>
        <button
          title="Voir le détail"
          onClick={onView}
          style={{
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6,
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-surface-raised)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <VisibilityIcon style={{ fontSize: 14 }} />
        </button>
      </Td>
    </tr>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <Card style={{ padding: 'var(--space-4)', borderLeft: `3px solid ${color}` }}>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function Th({ children }) {
  return (
    <th style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function Td({ children, className = '', strong, muted, style }) {
  return (
    <td className={className} style={{ padding: '10px 12px', color: strong ? 'var(--text-primary)' : muted ? 'var(--text-tertiary)' : 'var(--text-primary)', fontWeight: strong ? 500 : 400, ...style }}>
      {children}
    </td>
  );
}

function AlertDetailModal({ alert, onClose }) {
  return (
    <Modal open={!!alert} onClose={onClose} title={alert ? `Alerte #${alert.id} — ${alert.server_id}` : ''}>
      {alert && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Badge tone={alert.decision === 'CRITICAL' ? 'critical' : 'warning'} dot>{alert.decision}</Badge>
            <SignalBadge label="AE" flagged={alert.autoencoder_flag} score={num(alert.autoencoder_score)} />
            <SignalBadge label="IF" flagged={alert.isolation_forest_flag} score={num(alert.isolation_forest_score)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {[
              { label: 'Serveur',      value: alert.server_id || '—' },
              { label: 'Statut',       value: alert.status === 'active' ? 'Active' : 'Acquittée' },
              { label: 'Latence P95',  value: fmtMs(alert.p95_response_time) + ' ms' },
              { label: 'Latence moy.', value: fmtMs(alert.avg_response_time) + ' ms' },
              { label: 'Erreurs 5xx',  value: fmtPct(alert.error_rate_5xx) },
              { label: 'Requêtes',     value: num(alert.request_count) ?? '—' },
              { label: 'Confiance ML', value: num(alert.confidence) !== null ? `${(num(alert.confidence) * 100).toFixed(0)}%` : '—' },
              { label: 'Créée le',     value: new Date(alert.created_at).toLocaleString('fr-FR') },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>{label}</div>
                <div className="mono" style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}