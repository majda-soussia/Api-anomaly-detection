/**
 * App.jsx
 * ---------
 * BEFORE: inline-styled <nav> built by hand, no error boundary — a render
 * error on any single page (e.g. a malformed date on one alert row) would
 * blank out the entire app, including the sidebar, with no way to recover
 * without a manual reload.
 * AFTER: routes wrapped in Layout (sidebar shell), ToastProvider available
 * app-wide, and an ErrorBoundary per-route so a crash on one page doesn't
 * take down navigation to the others.
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/layout/ErrorBoundary';

// Route-level code splitting: each page (and its charting/table deps) only
// loads when the user actually navigates to it, instead of one 625KB
// bundle shipped up front for every visitor.
const Overview = lazy(() => import('./pages/Overview'));
const Servers = lazy(() => import('./pages/Servers'));
const Alerts = lazy(() => import('./pages/Alerts'));
const History = lazy(() => import('./pages/History'));

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
                <Route path="/history" element={<History />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
