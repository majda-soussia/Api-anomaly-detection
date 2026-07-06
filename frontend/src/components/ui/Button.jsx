/**
 * components/ui/Button.jsx
 */
import { forwardRef } from 'react';

const Button = forwardRef(function Button(
  { children, variant = 'secondary', size = 'md', loading = false, disabled = false, icon, ...props },
  ref
) {
  const variants = {
    primary: { bg: 'var(--accent)', fg: '#0b0e14', border: 'var(--accent)' },
    secondary: { bg: 'var(--bg-surface-raised)', fg: 'var(--text-primary)', border: 'var(--border-strong)' },
    danger: { bg: 'var(--critical-soft)', fg: 'var(--critical)', border: 'var(--critical-border)' },
    ghost: { bg: 'transparent', fg: 'var(--text-secondary)', border: 'transparent' },
  };
  const v = variants[variant] || variants.secondary;
  const paddings = { sm: '4px 10px', md: '7px 14px', lg: '10px 18px' };
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: paddings[size],
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 500,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.fg,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        transition: `background var(--transition-fast), transform var(--transition-fast)`,
      }}
      onMouseDown={(e) => {
        if (!isDisabled) e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

export default Button;

export function Spinner({ size = 13 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        border: '2px solid currentColor',
        borderRightColor: 'transparent',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}
