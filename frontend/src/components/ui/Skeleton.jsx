/**
 * components/ui/Skeleton.jsx
 * Loading placeholder — shimmer instead of a spinner for content that has a
 * known shape (table rows, cards), so the layout doesn't jump once real
 * data arrives.
 */
export default function Skeleton({ width = '100%', height = 14, radius = 4, style }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--bg-surface-raised) 25%, var(--bg-surface-hover) 37%, var(--bg-surface-raised) 63%)',
        backgroundSize: '400px 100%',
        animation: 'shimmer 1.4s ease infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonRow({ columns = 6 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <Skeleton height={12} width={i === 0 ? 40 : '80%'} />
        </td>
      ))}
    </tr>
  );
}
