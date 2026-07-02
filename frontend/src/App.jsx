// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Verify2FA from './pages/Verify2FA';
import Overview from './pages/Overview';
import Servers from './pages/Servers';
import Register from './pages/Register';

const LogPulseLogo = () => (
  <svg width="100" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" aria-label="LogPulse">
    <circle cx="150" cy="100" r="52" fill="none" stroke="#111111" strokeWidth="1.5" />
    <path d="M 106,100 L 122,100 L 128,76 L 136,128 L 143,100 L 149,86 L 155,100 L 194,100"
      fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <text fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="56" y="117">
      <tspan x="228" fontWeight="200" fill="#111111" opacity="0.55">Log</tspan>
      <tspan fontWeight="300" fill="#111111">Pulse</tspan>
    </text>
  </svg>
);

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    background: #FAFAF8;
    color: #111111;
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
  }

  .app-navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    height: 56px;
    background: #FFFFFF;
    border-bottom: 1px solid #E5E4DF;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .navbar-divider {
    width: 1px;
    height: 18px;
    background: #E5E4DF;
  }

  .navbar-links { display: flex; gap: 2px; }

  .navbar-link {
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #9CA3AF;
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }

  .navbar-link:hover { color: #374151; background: #F3F2EE; }
  .navbar-link.active { color: #111111; background: #F3F2EE; }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .navbar-role-badge {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    background: #F0F0F7;
    color: #1A1A2E;
    border: 1px solid #D1D0E8;
  }

  .navbar-email {
    font-size: 13px;
    color: #9CA3AF;
  }

  .navbar-logout {
    background: none;
    border: 1px solid #E5E4DF;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    color: #9CA3AF;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .navbar-logout:hover { border-color: #C4C3BC; color: #374151; }

  .app-content {
    padding: 32px;
    max-width: 1280px;
    margin: 0 auto;
  }
`;

function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <nav className="app-navbar">
      <div className="navbar-left">
        <LogPulseLogo />
        <div className="navbar-divider" />
        <div className="navbar-links">
          <NavLink
            to="/overview"
            className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
          >
            Overview
          </NavLink>
          <NavLink
            to="/servers"
            className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
          >
            Servers
          </NavLink>
        </div>
      </div>
      <div className="navbar-right">
        <span className="navbar-role-badge">{user.role}</span>
        <span className="navbar-email">{user.email}</span>
        <button className="navbar-logout" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <style>{globalStyles}</style>
      <BrowserRouter>
        <Navbar />
        <div className="app-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-2fa" element={<Verify2FA />} />
            <Route path="/overview" element={
              <ProtectedRoute><Overview /></ProtectedRoute>
            } />
            <Route path="/servers" element={
              <ProtectedRoute><Servers /></ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/overview" replace />} />

          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;