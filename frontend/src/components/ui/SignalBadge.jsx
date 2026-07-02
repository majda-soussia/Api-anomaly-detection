import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CheckIcon from '@mui/icons-material/Check';
export default function SignalBadge({ label, flagged, score }) {
  const tone = flagged ? 'var(--critical)' : 'var(--success)';
  return (
    <span
      title={`${label}: score ${score?.toFixed(3) ?? '—'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color: tone,
        background: `color-mix(in srgb, ${tone} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone} 35%, transparent)`,
      }}
    >
      {label} {flagged ? <ReportProblemIcon style={{ fontSize: 12 }} /> : <CheckIcon style={{ fontSize: 12 }} />}
    </span>
  );
}