/**
 * components/ui/FormControls.jsx
 */

const controlStyle = {
  padding: '7px 10px',
  fontSize: 13,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-strong)',
  background: 'var(--bg-surface-raised)',
  color: 'var(--text-primary)',
  outline: 'none',
};

export function Select({ value, onChange, options, ...props }) {
  return (
    <select value={value} onChange={onChange} style={{ ...controlStyle, cursor: 'pointer' }} {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher…' }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
      <span
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)',
          fontSize: 13,
          pointerEvents: 'none',
        }}
      >
        ⌕
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...controlStyle, width: '100%', paddingLeft: 28 }}
      />
    </div>
  );
}
