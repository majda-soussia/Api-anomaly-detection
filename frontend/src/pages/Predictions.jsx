import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/apiClient';
import { useDebounce } from '../hooks/useDebounce';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { Select, SearchInput } from '../components/ui/FormControls';
import { SkeletonRow } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/StateViews';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import VisibilityIcon from '@mui/icons-material/Visibility';

const LIMIT = 20;
const POLL_MS = 15000;

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmtMs = (v) => (num(v) !== null ? num(v).toLocaleString('fr-FR') : '—');
const fmtPct = (v) => (num(v) !== null ? `${(num(v) * 100).toFixed(2)}%` : '—');

const DECISION_TONE = { CRITICAL: 'critical', WARNING: 'warning', NORMAL: 'success' };

export default function Predictions() {
  const [predictions, setPredictions] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [breakdown, setBreakdown] = useState({ NORMAL: 0, WARNING: 0, CRITICAL: 0 });

  const [decision, setDecision] = useState('');
  const [datePreset, setDatePreset] = useState('today');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState(null);

  const dateRange = useMemo(() => {
    const to = new Date();
    const days = { today: 1, week: 7, month: 30, all: null }[datePreset];
    if (!days) return {};
    const from = new Date(to.getTime() - days * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [datePreset]);

  const queryParams = useMemo(
    () => ({
      decision: decision || undefined,
      server_id: debouncedSearch || undefined,
      ...dateRange,
      sort: 'created_at',
      order: 'desc',
      limit: LIMIT,
      offset,
    }),
    [decision, debouncedSearch, dateRange, offset]
  );

  const fetchPredictions = useCallback(async () => {
    setStatus('loading');
    try {
      const { data, meta } = await api.getPredictions(queryParams);
      setPredictions(data);
      setTotal(meta?.total ?? 0);
      setStatus('idle');
      setLastUpdated(Date.now());
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof ApiError ? err.message : 'Impossible de charger le journal des prédictions.');
    }
  }, [queryParams]);

  const fetchBreakdown = useCallback(async () => {
    try {
      const { data } = await api.getPredictionsBreakdown(dateRange);
      setBreakdown(data);
    } catch {
      // Résumé optionnel — le tableau principal reste utilisable sans lui.
    }
  }, [dateRange]);

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  useEffect(() => {
    fetchBreakdown();
    const interval = setInterval(fetchBreakdown, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchBreakdown]);

  function resetFilters() {
    setDecision('');
    setDatePreset('today');
    setSearch('');
    setOffset(0);
  }

  const secondsAgo = lastUpdated ? Math.max(0, Math.round((Date.now() - lastUpdated) / 1000)) : null;
  const totalCount = breakdown.NORMAL + breakdown.WARNING + breakdown.CRITICAL;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Journal des prédictions</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Historique complet du pipeline hybride, y compris les décisions NORMAL.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {secondsAgo !== null && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Dernière mise à jour : {secondsAgo}s</span>
          )}
          <button onClick={fetchPredictions} title="Rafraîchir" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <RefreshIcon style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      {totalCount > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {['NORMAL', 'WARNING', 'CRITICAL'].map((d) => (
            <div
              key={d}
              style={{
                flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{d}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{breakdown[d]}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {totalCount > 0 ? `${((breakdown[d] / totalCount) * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder="Rechercher par serveur…" />
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
          value={decision}
          onChange={(e) => { setDecision(e.target.value); setOffset(0); }}
          options={[
            { value: '', label: 'Toutes décisions' },
            { value: 'NORMAL', label: 'NORMAL' },
            { value: 'WARNING', label: 'WARNING' },
            { value: 'CRITICAL', label: 'CRITICAL' },
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
              <Th>Décision</Th>
              <Th>Serveur</Th>
              <Th>P95 (ms)</Th>
              <Th>Moy. (ms)</Th>
              <Th>Erreurs 5XX</Th>
              <Th>Requêtes</Th>
              <Th>Confiance</Th>
              <Th>Date</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {status === 'loading' && predictions.length === 0 && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} columns={10} />)}
            {status !== 'loading' && predictions.length > 0 &&
              predictions.map((p) => <PredictionRow key={p.id} prediction={p} onView={() => setDetail(p)} />)}
          </tbody>
        </table>

        {status === 'error' && <ErrorState message={errorMsg} onRetry={fetchPredictions} />}
        {status !== 'error' && status !== 'loading' && predictions.length === 0 && (
          <EmptyState title="Aucune prédiction" description="Aucune prédiction ne correspond aux filtres actuels." />
        )}

        {predictions.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '0 var(--space-4)' }}>
            <Pagination total={total} limit={LIMIT} offset={offset} onChange={setOffset} />
          </div>
        )}
      </div>

      <PredictionDetailModal prediction={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function Th({ children }) {
  return (
    <th style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function Td({ children, className = '', muted, style }) {
  return (
    <td className={className} style={{ padding: '10px 12px', color: muted ? 'var(--text-tertiary)' : 'var(--text-primary)', ...style }}>
      {children}
    </td>
  );
}

function PredictionRow({ prediction, onView }) {
  const errRate = num(prediction.error_rate_5xx);
  const p95 = num(prediction.p95_response_time);

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <Td className="mono" muted>#{prediction.id}</Td>
      <Td>
        <Badge tone={DECISION_TONE[prediction.decision] || 'default'} dot>{prediction.decision}</Badge>
      </Td>
      <Td>{prediction.server_id || '—'}</Td>
      <Td className="mono" style={{ color: p95 !== null && p95 > 1000 ? 'var(--critical)' : undefined }}>{fmtMs(prediction.p95_response_time)}</Td>
      <Td className="mono">{fmtMs(prediction.avg_response_time)}</Td>
      <Td className="mono" style={{ color: errRate !== null && errRate > 0.05 ? 'var(--critical)' : undefined }}>{fmtPct(prediction.error_rate_5xx)}</Td>
      <Td className="mono">{num(prediction.request_count) ?? '—'}</Td>
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono" style={{ fontSize: 12, minWidth: 32 }}>
            {num(prediction.confidence) !== null ? `${(num(prediction.confidence) * 100).toFixed(0)}%` : '—'}
          </span>
          <div style={{ width: 44, height: 4, borderRadius: 2, background: 'var(--bg-canvas)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(num(prediction.confidence) ?? 0) * 100}%`, height: '100%', borderRadius: 2,
                background:
                  prediction.decision === 'CRITICAL' ? 'var(--critical)' :
                  prediction.decision === 'WARNING' ? 'var(--warning)' : 'var(--success)',
              }}
            />
          </div>
        </div>
      </Td>
      <Td muted style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(prediction.created_at).toLocaleString('fr-FR')}</Td>
      <Td>
        <button
          title="Voir le détail"
          onClick={onView}
          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-surface-raised)', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <VisibilityIcon style={{ fontSize: 14 }} />
        </button>
      </Td>
    </tr>
  );
}

function PredictionDetailModal({ prediction, onClose }) {
  return (
    <Modal open={!!prediction} onClose={onClose} title={prediction ? `Prédiction #${prediction.id} — ${prediction.server_id}` : ''}>
      {prediction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Badge tone={DECISION_TONE[prediction.decision] || 'default'} dot>{prediction.decision}</Badge>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>Vecteur de features (raw_payload)</div>
            <pre className="mono" style={{ fontSize: 12, background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', overflow: 'auto', maxHeight: 300 }}>
              {JSON.stringify(prediction.raw_payload ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}