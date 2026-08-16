import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Forecast from './pages/Forecast';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { authFetch } from './utils/api';
import { useAuth } from './context/useAuth';

function App() {
  const { authed, logout } = useAuth();

  // No loading/error state here on purpose — this is footer chrome, not a
  // panel the user is waiting on. If it fails to load, the footer just
  // doesn't render; nothing about the rest of the app should be blocked or
  // show an error banner over a "how fresh is the data" nicety.
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!authed) return; // no point calling a protected endpoint pre-login
    async function loadStatus() {
      try {
        const res = await authFetch('/api/v1/warehouse/status');
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data);
      } catch {
        // fail silently — see comment above
      }
    }
    loadStatus();
  }, [authed]); // re-run once auth flips true, not tied to any date range

  return (
    <>
      {authed && (
        <nav className="nav">
          <Link to="/">Dashboard</Link>
          <Link to="/forecast">Forecast</Link>
          <button type="button" className="nav-logout" onClick={logout}>Log out</button>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/forecast" element={<ProtectedRoute><Forecast /></ProtectedRoute>} />
      </Routes>
      {status && (
        <footer className="app-footer">
          Data as of: {status.last_synced.replace('T', ' ')}
        </footer>
      )}
    </>
  );
}

export default App;
