import { NavLink } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import HistoryIcon from '@mui/icons-material/History';
import { useActiveAlertsCount } from '../../hooks/useActiveAlertsCount';


const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: <DashboardIcon /> },
  { to: '/servers', label: 'Servers', icon: <StorageIcon /> },
  { to: '/alerts', label: 'Alerts', icon: <NotificationImportantIcon /> , badge: true},
  { to: '/history', label: 'History', icon: <HistoryIcon /> },
];

export default function Sidebar({ connected }) {
  const activeAlerts = useActiveAlertsCount();

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'linear-gradient(135deg, var(--accent), #3b6fd9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          M
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>Mobile API</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>Supervision</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-surface-raised)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            })}
          >
            <span style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && !!activeAlerts && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#0b0e14',
                  background: 'var(--critical)',
                  borderRadius: 999,
                  minWidth: 17,
                  height: 17,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {activeAlerts > 99 ? '99+' : activeAlerts}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px var(--space-4)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <SignalIcon connected={connected} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: connected ? 'var(--success)' : 'var(--critical)' }}>
            {connected ? 'Connected' : 'Déconnecté'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Real-time monitoring</span>
        </div>
      </div>

      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          A
        </div>
        <div style={{ lineHeight: 1.3, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Admin</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            admin@mobile-api.com
          </div>
        </div>
      </div>
    </aside>
  );
}

function SignalIcon({ connected }) {
  const heights = [6, 10, 14];
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 6}
          y={14 - h}
          width="4"
          height={h}
          rx="1"
          fill={connected ? 'var(--success)' : 'var(--text-tertiary)'}
          opacity={connected ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}