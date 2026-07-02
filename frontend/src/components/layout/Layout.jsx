import { useMetricsSocket } from '../../hooks/useSocket';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const { connected } = useMetricsSocket();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar connected={connected} />
      <main style={{ flex: 1, minWidth: 0, padding: 'var(--space-8)' }}>{children}</main>
    </div>
  );
}
