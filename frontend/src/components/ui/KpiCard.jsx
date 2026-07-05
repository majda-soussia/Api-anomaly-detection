import Sparkline from './Sparkline';
import InfoIcon from '@mui/icons-material/Info';

export default function KpiCard({ icon, iconTone, label, value, sublabel, sparklinePoints, sparklineColor, trendPct, infoText }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCircle icon={icon} tone={iconTone} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        {infoText && (
          <span title={infoText} style={{ color: 'var(--text-tertiary)', fontSize: 12, cursor: 'help' }}  >
            <InfoIcon style={{ fontSize: 14 }} />
          </span>
            
        )}
      </div>

      <div className="mono" style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>
        {value}
      </div>
      {sublabel && <div style={{ fontSize: 12, color: iconTone, marginBottom: 'var(--space-4)' }}>{sublabel}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Sparkline points={sparklinePoints} color={sparklineColor} />
        {trendPct !== null && trendPct !== undefined && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>vs hier</div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: trendPct >= 0 ? 'var(--success)' : 'var(--critical)' }}>
              {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct).toFixed(0)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IconCircle({ icon, tone }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
        color: tone,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
  );
}