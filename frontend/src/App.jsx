// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Overview from './pages/Overview';
import Servers from './pages/Servers';

function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 16, borderBottom: '1px solid #444', display: 'flex', gap: 16 }}>
        <NavLink
          to="/overview"
          style={({ isActive }) => ({ color: isActive ? '#4ec9b0' : '#d4d4d4', textDecoration: 'none' })}
        >
          Overview
        </NavLink>
        <NavLink
          to="/servers"
          style={({ isActive }) => ({ color: isActive ? '#4ec9b0' : '#d4d4d4', textDecoration: 'none' })}
        >
          Servers
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/servers" element={<Servers />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;