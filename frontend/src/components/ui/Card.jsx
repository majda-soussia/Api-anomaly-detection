/**
 * components/ui/Card.jsx
 */
export default function Card({ children, style, hover = false, ...props }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        transition: hover ? 'border-color var(--transition-base), transform var(--transition-base)' : undefined,
        ...style,
      }}
      onMouseEnter={
        hover
          ? (e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  );
}
