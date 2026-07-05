import SyncIcon from '@mui/icons-material/Sync';

export function EmptyState({ title, description, action }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-10) var(--space-6)',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ fontSize: 32, opacity: 0.5, marginBottom: 4 }}><SyncIcon /></div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      {description && <div style={{ fontSize: 13, maxWidth: 360 }}>{description}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-10) var(--space-6)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--critical)', fontWeight: 500 }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--critical-border)',
            background: 'var(--critical-soft)',
            color: 'var(--critical)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
