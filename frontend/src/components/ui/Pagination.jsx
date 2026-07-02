/**
 * components/ui/Pagination.jsx
 */
export default function Pagination({ total, limit, offset, onChange }) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const goTo = (p) => onChange(Math.max(0, Math.min(totalPages - 1, p - 1)) * limit);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
      <span>
        {total === 0 ? '0 résultat' : `${offset + 1}–${Math.min(offset + limit, total)} sur ${total}`}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <PageButton disabled={page <= 1} onClick={() => goTo(page - 1)} label="‹ Précédent" />
        <span style={{ padding: '4px 10px', fontFamily: 'var(--font-mono)' }}>
          {page} / {totalPages}
        </span>
        <PageButton disabled={page >= totalPages} onClick={() => goTo(page + 1)} label="Suivant ›" />
      </div>
    </div>
  );
}

function PageButton({ disabled, onClick, label }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-strong)',
        background: 'var(--bg-surface-raised)',
        color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}
