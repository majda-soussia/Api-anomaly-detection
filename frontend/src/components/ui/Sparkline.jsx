/**
 * components/ui/Sparkline.jsx
 * -------------------------------
 * Real bucketed counts from created_at timestamps, not a fake trend line.
 * If `points` is empty, renders a flat line instead of hiding.
 */
export default function Sparkline({ points = [], color = 'var(--accent)', width = 96, height = 28 }) {
  const values = points.length ? points : [0, 0];
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);

  const coords = values.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`);
  const linePath = `M${coords.join(' L')}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={areaPath} fill={color} opacity="0.12" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}