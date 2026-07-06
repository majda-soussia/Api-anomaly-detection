import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/layout/ErrorBoundary';

const Overview = lazy(() => import('./pages/Overview'));
const Servers = lazy(() => import('./pages/Servers'));
const Alerts = lazy(() => import('./pages/Alerts'));
function PageFallback() {
  return <div style={{ padding: 'var(--space-8)', color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement…</div>;
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/servers" element={<Servers />} />
                <Route path="/alerts" element={<Alerts />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
