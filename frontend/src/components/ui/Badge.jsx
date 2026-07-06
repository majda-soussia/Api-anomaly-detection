/**
 * components/ui/Badge.jsx
 * Reusable pill badge. `tone` maps to the status palette so CRITICAL/WARNING
 * always render with the same reserved colors everywhere they appear.
 */

const TONES = {
  critical: { fg: 'var(--critical)', bg: 'var(--critical-soft)', border: 'var(--critical-border)' },
  warning: { fg: 'var(--warning)', bg: 'var(--warning-soft)', border: 'var(--warning-border)' },
  success: { fg: 'var(--success)', bg: 'var(--success-soft)', border: 'var(--success-border)' },
  accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent-border)' },
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--neutral-soft)', border: 'var(--border-strong)' },
};

export default function Badge({ tone = 'neutral', children, dot = false }) {
  const c = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: c.fg,
            animation: tone === 'critical' ? 'pulse 1.6s infinite' : 'none',
          }}
        />
      )}
      {children}
    </span>
  );
}
