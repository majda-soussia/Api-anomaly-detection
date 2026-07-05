/**
 * components/ui/DualSignal.jsx
 * -------------------------------
 * SIGNATURE ELEMENT — the one deliberate visual idea of this redesign.
 *
 * This product's real identity isn't "an alerts table," it's a specific,
 * unusual ML architecture: two independent models score every window, the
 * Autoencoder decides, the Isolation Forest only qualifies severity, and
 * IF can never override AE (see PROJECT_BRIEFING.md §3.4). A generic single
 * confidence bar erases that. This component always shows both signals as
 * two distinct segments — AE on top (larger, filled solid — it's the
 * decider), IF below (thinner, outlined — it's the qualifier) — so the
 * hierarchy between the two models is visible at a glance on every alert,
 * not just documented in a README.
 */

export default function DualSignal({ aeScore, aeFlag, ifScore, ifFlag, threshold }) {
  const aePct = threshold ? Math.min(100, (aeScore / (threshold * 2)) * 100) : 0;
  const ifPct = Math.min(100, Math.abs(ifScore ?? 0) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 88 }} title={`AE: ${aeScore?.toFixed(3)} · IF: ${ifScore?.toFixed(3)}`}>
      <Segment label="AE" pct={aePct} active={aeFlag} color="var(--critical)" filled />
      <Segment label="IF" pct={ifPct} active={ifFlag} color="var(--warning)" filled={false} />
    </div>
  );
}

function Segment({ label, pct, active, color, filled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', width: 14 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 3,
          background: 'var(--bg-canvas)',
          border: filled ? 'none' : `1px solid var(--border-strong)`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: active ? color : 'var(--text-tertiary)',
            opacity: active ? 1 : 0.4,
            borderRadius: 3,
            transition: 'width var(--transition-base)',
          }}
        />
      </div>
    </div>
  );
}
