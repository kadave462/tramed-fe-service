import { useState, useEffect } from 'react';

const API = 'https://david-api-la1t.onrender.com';

function Forecast() {
  const [days, setDays] = useState(30);

  const [stockForecast, setStockForecast] = useState([]);
  const [stockForecastLoading, setStockForecastLoading] = useState(true);
  const [stockForecastError, setStockForecastError] = useState(null);

  useEffect(() => {
    async function loadStockForecast() {
      try {
        setStockForecastLoading(true);
        const res = await fetch(`${API}/api/v1/analytics/stock-forecast?days=${days}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStockForecast(data);
      } catch (err) {
        setStockForecastError(err.message);
      } finally {
        setStockForecastLoading(false);
      }
    }
    loadStockForecast();
  }, [days]);

  return (
    <div>
      <header className="app-header">
        <h1>Stock Forecast</h1>
        <p className="kpi-label">The 15 items soonest to run out, given the last {days}-day sales rate</p>
      </header>

      <div className="controls">
        <input
          type="number"
          min="1"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </div>

      {stockForecastLoading && <p>Loading…</p>}
      {stockForecastError && <p>Error: {stockForecastError}</p>}
      {!stockForecastLoading && !stockForecastError && (
        // the server already sorts soonest-to-run-out first, so the first 15
        // rows are exactly the products worth worrying about — everything
        // after that is slow-moving stock with huge, not-urgent days-left
        <section className="card card-narrow">
          <table>
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Item</th>
                <th>Current stock</th>
                <th>Avg daily sales</th>
                <th>Days remaining</th>
              </tr>
            </thead>
            <tbody>
              {stockForecast.slice(0, 15).map((row) => (
                <tr key={row.itemId}>
                  <td>{row.itemId}</td>
                  <td>{row.itemName}</td>
                  <td>{row.currentStock}</td>
                  <td>{row.avgDailySales.toFixed(2)}</td>
                  <td>{row.daysRemaining.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default Forecast;
