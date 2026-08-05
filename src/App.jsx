import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Forecast from './pages/Forecast';

const API = 'https://david-api-la1t.onrender.com';

function App() {
  // No loading/error state here on purpose — this is footer chrome, not a
  // panel the user is waiting on. If it fails to load, the footer just
  // doesn't render; nothing about the rest of the app should be blocked or
  // show an error banner over a "how fresh is the data" nicety.
  const [status, setStatus] = useState(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`${API}/api/v1/warehouse/status`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data);
      } catch {
        // fail silently — see comment above
      }
    }
    loadStatus();
  }, []); // run once when the app first loads — not tied to any date range

  return (
    <>
      <nav className="nav">
        <Link to="/">Dashboard</Link>
        <Link to="/forecast">Forecast</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/forecast" element={<Forecast />} />
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
