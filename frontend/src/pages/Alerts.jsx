
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/apiClient';
import { useAlertEvents } from '../hooks/useSocket';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import KpiCard from '../components/ui/KpiCard';
import SignalBadge from '../components/ui/SignalBadge';
import Pagination from '../components/ui/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import { Select, SearchInput } from '../components/ui/FormControls';
import { SkeletonRow } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/StateViews';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningIcon from '@mui/icons-material/Warning';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
const LIMIT = 10;
const POLL_MS = 30000;

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmtMs = (v) => (num(v) !== null ? num(v).toLocaleString('fr-FR') : '—');
const fmtPct = (v) => (num(v) !== null ? `${(num(v) * 100).toFixed(2)}%` : '—');

function trendOf(today, yesterday) {
  if (!yesterday) return null;
  return ((today - yesterday) / yesterday) * 100;
}

function hourlyBuckets(alerts, hours = 24, predicate = () => true) {
  const now = Date.now();
  const bucketMs = (hours * 3600000) / 6; // 6 points across the window
  const buckets = new Array(6).fill(0);
  alerts.filter(predicate).forEach((a) => {
    const age = now - new Date(a.created_at).getTime();
    const idx = 5 - Math.min(5, Math.floor(age / bucketMs));
    if (idx >= 0) buckets[idx] += 1;
  });
  return buckets;
}
export default function Alerts() {
  const toast = useToast();

  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [window48h, setWindow48h] = useState([]);

  const [filters, setFilters] = useState({ decision: '', status: '' });
  const [datePreset, setDatePreset] = useState('today');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sort] = useState({ sort: 'created_at', order: 'desc' });
  const [offset, setOffset] = useState(0);

  const [ackTarget, setAckTarget] = useState(null);
  const [acking, setAcking] = useState(null);
  const [detailAlert, setDetailAlert] = useState(null);

  const dateRange = useMemo(() => {
    const to = new Date();
    const days = { today: 1, week: 7, month: 30, all: null }[datePreset];
    if (!days) return {};
    const from = new Date(to.getTime() - days * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [datePreset]);

  const queryParams = useMemo(
    () => ({
      ...filters,
      server_id: debouncedSearch || undefined,
      ...dateRange,
      ...sort,
      limit: LIMIT,
      offset,
    }),
    [filters, debouncedSearch, dateRange, sort, offset]
  );

  const fetchAlerts = useCallback(async () => {
    setStatus('loading');
    try {
      const { data, meta } = await api.getAlerts(queryParams);
      setAlerts(data);
      setTotal(meta?.total ?? 0);
      setStatus('idle');
      setLastUpdated(Date.now());
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof ApiError ? err.message : 'Impossible de charger les alertes.');
    }
  }, [queryParams]);

  const fetchKpiWindow = useCallback(async () => {
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 48 * 3600000);
      const { data } = await api.getAlerts({ from: from.toISOString(), to: to.toISOString(), sort: 'created_at', order: 'desc', limit: 500 });
      setWindow48h(data);
    } catch {
      // KPI strip degrades gracefully — main table below still works independently.
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    fetchKpiWindow();
    const interval = setInterval(fetchKpiWindow, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchKpiWindow]);

  const isDefaultView = offset === 0 && datePreset === 'today' && !filters.decision && !filters.status && !debouncedSearch;
  useAlertEvents(
    useCallback(
      (alert) => {
        toast[alert.decision === 'CRITICAL' ? 'error' : 'info'](`Nouvelle alerte ${alert.decision} — serveur ${alert.server_id}`);
        setWindow48h((prev) => [alert, ...prev]);
        if (isDefaultView) {
          setAlerts((prev) => [alert, ...prev].slice(0, LIMIT));
          setTotal((t) => t + 1);
        }
      },
      [isDefaultView, toast]
    )
  );

  // --- KPI computation: today vs yesterday, from the single 48h window ---
  const now = Date.now();
  const isToday = (a) => now - new Date(a.created_at).getTime() < 86400000;
  const isYesterday = (a) => {
    const age = now - new Date(a.created_at).getTime();
    return age >= 86400000 && age < 2 * 86400000;
  };

  const todayAlerts = window48h.filter(isToday);
  const yesterdayAlerts = window48h.filter(isYesterday);

  const kpis = {
    total: { today: todayAlerts.length, yesterday: yesterdayAlerts.length },
    active: {
      today: todayAlerts.filter((a) => a.status === 'active').length,
      yesterday: yesterdayAlerts.filter((a) => a.status === 'active').length,
    },
    critical: {
      today: todayAlerts.filter((a) => a.decision === 'CRITICAL').length,
      yesterday: yesterdayAlerts.filter((a) => a.decision === 'CRITICAL').length,
    },
    warning: {
      today: todayAlerts.filter((a) => a.decision === 'WARNING').length,
      yesterday: yesterdayAlerts.filter((a) => a.decision === 'WARNING').length,
    },
  };

  async function confirmAcknowledge() {
    const alert = ackTarget;
    setAckTarget(null);
    setAcking(alert.id);
    try {
      await api.acknowledgeAlert(alert.id);
      toast.success(`Alerte #${alert.id} acquittée.`);
      fetchAlerts();
      fetchKpiWindow();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec de l'acquittement.");
    } finally {
      setAcking(null);
    }
  }

  function copyId(id) {
    navigator.clipboard?.writeText(String(id));
    toast.success(`ID #${id} copié.`);
  }

  function resetFilters() {
    setFilters({ decision: '', status: '' });
    setDatePreset('today');
    setSearch('');
    setOffset(0);
  }

  const secondsAgo = lastUpdated ? Math.max(0, Math.round((Date.now() - lastUpdated) / 1000)) : null;
  return (
    <div>
      <PageHeader secondsAgo={secondsAgo} connected={status !== 'error'} onRefresh={fetchAlerts} />
      <MethodLegend />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <KpiCard
          icon={<NotificationsIcon />}
          iconTone="var(--accent)"
          label="Total alertes"
          value={kpis.total.today}
          sublabel={`+${Math.max(0, kpis.total.today - kpis.total.yesterday)} aujourd'hui`}
          sparklinePoints={hourlyBuckets(window48h, 24, isToday)}
          sparklineColor="var(--accent)"
          trendPct={trendOf(kpis.total.today, kpis.total.yesterday)}
          infoText="Alertes créées sur les dernières 24h, comparé aux 24h précédentes."
        />
        <KpiCard
          icon={<ShieldIcon />}
          iconTone="var(--success)"
          label="Alertes actives"
          value={kpis.active.today}
          sublabel="Sur les dernières 24h"
          sparklinePoints={hourlyBuckets(window48h, 24, (a) => isToday(a) && a.status === 'active')}
          sparklineColor="var(--success)"
          trendPct={trendOf(kpis.active.today, kpis.active.yesterday)}
          infoText="Alertes non acquittées créées sur les dernières 24h."
        />
        <KpiCard
          icon={<WarningIcon />}
          iconTone="var(--critical)"
          label="Critiques"
          value={kpis.critical.today}
          sublabel="Nécessitent attention"
          sparklinePoints={hourlyBuckets(window48h, 24, (a) => isToday(a) && a.decision === 'CRITICAL')}
          sparklineColor="var(--critical)"
          trendPct={trendOf(kpis.critical.today, kpis.critical.yesterday)}
          infoText="Autoencoder ET Isolation Forest ont tous deux détecté une anomalie."
        />
        <KpiCard
          icon={<FilterCenterFocusIcon />}
          iconTone="var(--warning)"
          label="Warnings"
          value={kpis.warning.today}
          sublabel="Sous observation"
          sparklinePoints={hourlyBuckets(window48h, 24, (a) => isToday(a) && a.decision === 'WARNING')}
          sparklineColor="var(--warning)"
          trendPct={trendOf(kpis.warning.today, kpis.warning.yesterday)}
          infoText="Seul l'Autoencoder a détecté une anomalie : Isolation Forest n'a pas confirmé."
        />
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder="Rechercher par serveur ou ID…" />
        <Select
          value={datePreset}
          onChange={(e) => { setDatePreset(e.target.value); setOffset(0); }}
          options={[
            { value: 'today', label: "Aujourd'hui" },
            { value: 'week', label: '7 derniers jours' },
            { value: 'month', label: '30 derniers jours' },
            { value: 'all', label: 'Toutes les dates' },
          ]}
        />
        <Select
          value={filters.decision}
          onChange={(e) => { setFilters((f) => ({ ...f, decision: e.target.value })); setOffset(0); }}
          options={[
            { value: '', label: 'Tous niveaux' },
            { value: 'CRITICAL', label: 'CRITICAL' },
            { value: 'WARNING', label: 'WARNING' },
          ]}
        />
        <Select
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setOffset(0); }}
          options={[
            { value: '', label: 'Tous statuts' },
            { value: 'active', label: 'Actives' },
            { value: 'acknowledged', label: 'Acquittées' },
          ]}
        />
        <Button variant="ghost" onClick={resetFilters}>
          <ReplayIcon style={{ fontSize: 14 }} />
          Réinitialiser
        </Button>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-raised)' }}>
              <Th>ID</Th>
              <Th>Niveau</Th>
              <Th>Serveur</Th>
              <Th>P95</Th>
              <Th>Moy.</Th>
              <Th>Erreurs 5xx</Th>
              <Th>Requêtes</Th>
              <Th>Signal (AE / IF)</Th>
              <Th>Confiance</Th>
              <Th>Date</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {status === 'loading' && alerts.length === 0 && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} columns={11} />)}
            {status !== 'loading' && alerts.length > 0 &&
              alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  acking={acking === alert.id}
                  onAcknowledge={() => setAckTarget(alert)}
                  onView={() => setDetailAlert(alert)}
                  onCopyId={() => copyId(alert.id)}
                />
              ))}
          </tbody>
        </table>

        {status === 'error' && <ErrorState message={errorMsg} onRetry={fetchAlerts} />}
        {status !== 'error' && status !== 'loading' && alerts.length === 0 && (
          <EmptyState title="Aucune alerte" description="Aucune alerte ne correspond aux filtres actuels." />
        )}

        {alerts.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '0 var(--space-4)' }}>
            <Pagination total={total} limit={LIMIT} offset={offset} onChange={setOffset} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 'var(--space-4)', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        Astuce : cliquez sur l'icône <span className="mono"><VisibilityIcon style={{ fontSize: 14 }} /></span> d'une alerte pour voir le vecteur de features complet ayant déclenché la décision.
      </div>

      <ConfirmDialog
        open={!!ackTarget}
        title={`Acquitter l'alerte #${ackTarget?.id}`}
        description={`Cette alerte ${ackTarget?.decision} sur le serveur ${ackTarget?.server_id} sera marquée comme traitée.`}
        confirmLabel="Acquitter"
        danger={ackTarget?.decision === 'CRITICAL'}
        onConfirm={confirmAcknowledge}
        onCancel={() => setAckTarget(null)}
      />

      <AlertDetailModal alert={detailAlert} onClose={() => setDetailAlert(null)} />
    </div>
  );
}
function PageHeader({ secondsAgo, connected, onRefresh }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Alertes</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Décisions du pipeline hybride Autoencoder + Isolation Forest, en temps réel.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {secondsAgo !== null && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Dernière mise à jour : {secondsAgo}s</span>
        )}
        <button onClick={onRefresh} title="Rafraîchir" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>
          <RefreshIcon style={{ fontSize: 16 }} />
        </button>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            color: connected ? 'var(--success)' : 'var(--critical)',
            background: connected ? 'var(--success-soft)' : 'var(--critical-soft)',
            border: `1px solid ${connected ? 'var(--success-border)' : 'var(--critical-border)'}`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {connected ? 'LIVE' : 'HORS LIGNE'}
        </span>
      </div>
    </div>
  );
}

function MethodLegend() {
 return 
}

function Th({ children }) {
  return <th style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{children}</th>;
}

function AlertRow({ alert, acking, onAcknowledge, onView, onCopyId }) {
  const errRate = num(alert.error_rate_5xx);
  const p95 = num(alert.p95_response_time);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <Td className="mono" muted>#{alert.id}</Td>
      <Td>
        <Badge tone={alert.decision === 'CRITICAL' ? 'critical' : 'warning'} dot>{alert.decision}</Badge>
      </Td>
      <Td strong>{alert.server_id || '—'}</Td>
      <Td className="mono" style={{ color: p95 !== null && p95 > 1000 ? 'var(--critical)' : undefined }}>{fmtMs(alert.p95_response_time)}</Td>
      <Td className="mono">{fmtMs(alert.avg_response_time)}</Td>
      <Td className="mono" style={{ color: errRate !== null && errRate > 0.05 ? 'var(--critical)' : undefined }}>{fmtPct(alert.error_rate_5xx)}</Td>
      <Td className="mono">{num(alert.request_count) ?? '—'}</Td>
      <Td>
        <div style={{ display: 'flex', gap: 4 }}>
          <SignalBadge label="AE" flagged={alert.autoencoder_flag} score={num(alert.autoencoder_score)} />
          <SignalBadge label="IF" flagged={alert.isolation_forest_flag} score={num(alert.isolation_forest_score)} />
        </div>
      </Td>
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono" style={{ fontSize: 12, minWidth: 32 }}>{num(alert.confidence) !== null ? `${(num(alert.confidence) * 100).toFixed(0)}%` : '—'}</span>
          <div style={{ width: 44, height: 4, borderRadius: 2, background: 'var(--bg-canvas)', overflow: 'hidden' }}>
            <div style={{ width: `${(num(alert.confidence) ?? 0) * 100}%`, height: '100%', background: alert.decision === 'CRITICAL' ? 'var(--critical)' : 'var(--warning)', borderRadius: 2 }} />
          </div>
        </div>
      </Td>
      <Td muted style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(alert.created_at).toLocaleString('fr-FR')}</Td>
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <IconButton title="Voir le détail" onClick={onView}>
            <VisibilityIcon  style={{ fontSize: 14 }}/>
          </IconButton>
          {alert.status === 'active' ? (
            <IconButton title="Acquitter" onClick={onAcknowledge} loading={acking}>
              <CheckIcon style={{ fontSize: 14 }} />
            </IconButton>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)' , display: 'flex', alignItems: 'center', gap: 4 , fontWeight: 'bold'}}>
              <CheckIcon style={{ fontSize: 16, color: 'var(--success)' }} /> 
              acquittée</span>
          )}
          <IconButton title="Plus d'actions" onClick={() => setMenuOpen((v) => !v)}>
            <MoreVertIcon  style={{ fontSize: 14 }}/>
          </IconButton>
          {menuOpen && (
            <div
              onMouseLeave={() => setMenuOpen(false)}
              style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, background: 'var(--bg-surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', minWidth: 140 }}
            >
              <button
                onClick={() => { onCopyId(); setMenuOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
              >
                Copier l'ID
              </button>
            </div>
          )}
        </div>
      </Td>
    </tr>
  );
}

function IconButton({ children, title, onClick, loading }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={loading}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: '1px solid var(--border-strong)',
        background: 'var(--bg-surface-raised)',
        color: 'var(--text-secondary)',
        cursor: loading ? 'wait' : 'pointer',
        fontSize: 12,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {children}
    </button>
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
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Vecteur de features (raw_payload)</div>
            <pre
              className="mono"
              style={{
                fontSize: 12,
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-3)',
                overflow: 'auto',
                maxHeight: 300,
              }}
            >
              {JSON.stringify(alert.raw_payload ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}