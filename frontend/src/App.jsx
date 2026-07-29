// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/layout/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import Verify2FA from './pages/Verify2FA';

const Overview = lazy(() => import('./pages/Overview'));
const Servers  = lazy(() => import('./pages/Servers'));
const Alerts   = lazy(() => import('./pages/Alerts'));
const History  = lazy(() => import('./pages/History'));
const Predictions = lazy(() => import('./pages/Predictions'));

function PageFallback() {
  return (
    <div style={{ padding: '32px', color: '#9CA3AF', fontSize: 13 }}>
      Chargement…
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* ── Public routes (no sidebar) ── */}
      <Route path="/login"      element={<Login />} />
      <Route path="/register"   element={<Register />} />
      <Route path="/verify-2fa" element={<Verify2FA />} />

      {/* ── Protected routes (with sidebar Layout) ── */}
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <Layout>
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/overview" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
                    <Route path="/servers"  element={<ProtectedRoute><Servers /></ProtectedRoute>} />
                    <Route path="/alerts"   element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                    <Route path="/history"  element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/predictions" element={<ProtectedRoute><Predictions /></ProtectedRoute>} />
                    <Route path="/"         element={<Navigate to="/overview" replace />} />
                    <Route path="*"         element={<Navigate to="/overview" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}