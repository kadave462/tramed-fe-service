import { useState, useEffect } from 'react';
import RevenueChart from '../components/RevenueChart';
import TopBarChart from '../components/TopBarChart';

const API = 'https://david-api-la1t.onrender.com';

function Dashboard() {
  //  the 3 memory slots
  const [revenue, setRevenue] = useState([]);    // the data — starts empty
  const [loading, setLoading] = useState(true);  // still fetching?
  const [error, setError] = useState(null);      // did it fail?

  //  the 3 new memory slots — what the user controls
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
  const [groupBy, setGroupBy] = useState('month');

  //  same data/loading/error trio, once per new panel — kept independent so
  //  one endpoint failing doesn't blank out the other panel's data
  const [topProducts, setTopProducts] = useState([]);
  const [topProductsLoading, setTopProductsLoading] = useState(true);
  const [topProductsError, setTopProductsError] = useState(null);

  const [topPayers, setTopPayers] = useState([]);
  const [topPayersLoading, setTopPayersLoading] = useState(true);
  const [topPayersError, setTopPayersError] = useState(null);

  const [topMovers, setTopMovers] = useState([]);
  const [topMoversLoading, setTopMoversLoading] = useState(true);
  const [topMoversError, setTopMoversError] = useState(null);

  //  expiring stock has its OWN date range (not the shared from/to above) —
  //  defaults to today through 30 days out, so the panel opens showing
  //  what's coming up, not already-expired stock or the entire future.
  const [expiringAfter, setExpiringAfter] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiringBefore, setExpiringBefore] = useState(() => {
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    return in30Days.toISOString().slice(0, 10);
  });
  const [expiringStock, setExpiringStock] = useState([]);
  const [expiringLoading, setExpiringLoading] = useState(true);
  const [expiringError, setExpiringError] = useState(null);

  //  runs once on first appearance, THEN again any time from/to/groupBy change
  //  ask the server, wait for the answer
  //  remember the answer (setRevenue / setLoading)
  //  catch failure instead of hanging forever
  useEffect(() => {
    async function loadRevenue() {
      try {
        setLoading(true); // show "Loading…" again on every re-fetch, not just the first
        const res = await fetch(
          `${API}/api/v1/analytics/revenue?from=${from}&to=${to}&groupBy=${groupBy}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRevenue(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadRevenue();
  }, [from, to, groupBy]); // re-run whenever any of these change

  //  fetches top-products, top-payers, AND top-movers together via
  //  Promise.all — all three requests fire at once instead of one waiting
  //  for the previous one. Only depends on [from, to], not groupBy — none
  //  of these three endpoints take a groupBy param.
  useEffect(() => {
    async function loadTopLists() {
      try {
        setTopProductsLoading(true);
        setTopPayersLoading(true);
        setTopMoversLoading(true);
        const [productsRes, payersRes, moversRes] = await Promise.all([
          fetch(`${API}/api/v1/analytics/top-products?from=${from}&to=${to}`),
          fetch(`${API}/api/v1/analytics/top-payers?from=${from}&to=${to}`),
          fetch(`${API}/api/v1/analytics/top-movers?from=${from}&to=${to}&limit=50`),
        ]);
        if (!productsRes.ok) throw new Error(`HTTP ${productsRes.status}`);
        if (!payersRes.ok) throw new Error(`HTTP ${payersRes.status}`);
        if (!moversRes.ok) throw new Error(`HTTP ${moversRes.status}`);
        const productsData = await productsRes.json();
        const payersData = await payersRes.json();
        const moversData = await moversRes.json();
        setTopProducts(productsData);
        setTopPayers(payersData);
        setTopMovers(moversData);
      } catch (err) {
        setTopProductsError(err.message);
        setTopPayersError(err.message);
        setTopMoversError(err.message);
      } finally {
        setTopProductsLoading(false);
        setTopPayersLoading(false);
        setTopMoversLoading(false);
      }
    }
    loadTopLists();
  }, [from, to]);

  //  independent of everything above — this is its own date range, not the
  //  shared from/to, so it gets its own effect keyed on
  //  [expiringAfter, expiringBefore] instead of piggybacking on the others.
  useEffect(() => {
    async function loadExpiringStock() {
      try {
        setExpiringLoading(true);
        const res = await fetch(
          `${API}/api/v1/analytics/expiring-stock?after=${expiringAfter}&before=${expiringBefore}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setExpiringStock(data);
      } catch (err) {
        setExpiringError(err.message);
      } finally {
        setExpiringLoading(false);
      }
    }
    loadExpiringStock();
  }, [expiringAfter, expiringBefore]);

  // Part A — KPI: derived from state already being fetched for the chart,
  // not a new request. .reduce() walks the array once, building a running total.
  const totalRevenue = revenue.reduce((sum, row) => sum + row.revenue, 0);
  // profit now rides along on the same revenue rows (the backend query was
  // extended to return cost/profit alongside revenue) — no new fetch needed.
  const totalProfit = revenue.reduce((sum, row) => sum + row.profit, 0);

  // % remaining per lot — computed here since the backend returns raw
  // quantity/initialQuantity, not a precomputed percentage, and TopBarChart
  // needs the value living directly on each row to plot it as a bar.
  const expiringWithPct = expiringStock.map((row) => ({
    ...row,
    pctRemaining: row.initialQuantity ? (row.quantity / row.initialQuantity) * 100 : 0,
  }));

  return (
    <div>
      {/* Part A — real header + the totalRevenue KPI, replacing the old bare <h1>Revenue</h1> */}
      <header className="app-header">
        <h1>TRAMED Dashboard</h1>
        <p>
          <span className="kpi-label">Total revenue ({from} – {to}): </span>
          <span className="kpi-value">
            {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
        <p>
          <span className="kpi-label">Total profit ({from} – {to}): </span>
          <span className="kpi-value">
            {totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
      </header>

      <div className="controls">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p>Error: {error}</p>}

      {/* Part A — CSS grid replacing the old ad-hoc flex row. auto-fit/minmax
          means no fixed column count: as many >=400px columns as fit the
          screen, stretched evenly to fill the rest — 1 column on a phone,
          3 on a wide monitor, no hand-written breakpoints. */}
      <div className="dashboard-grid">
        <section className="card">
          <h2>Revenue</h2>
          {!loading && !error && (
            // flex row: chart takes the wider share, the number list sits beside it.
            // wrap lets them stack on top of each other on a narrow window instead
            // of squeezing sideways forever.
            <div className="panel-row">
              {/* .chart-col = flex: '2 1 400px' — grows twice as eagerly as the
                  list, but never shrinks below 400px wide before wrapping */}
              <div className="chart-col">
                <RevenueChart data={revenue} />
              </div>

              {/* the exact numbers, scrollable so a long day-by-day list doesn't
                  push the page height around */}
              <ul className="scroll-list">
                {revenue.map((row) => (
                  <li key={row.period} className="list-row">
                    {row.period}: {row.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Top products</h2>
          {!topProductsLoading && !topProductsError && (
            <>
              <TopBarChart
                data={topProducts}
                xKey="productName"
                barKey="totalRevenue"
                detailKey="totalQuantity"
                detailLabel="Units sold"
              />
              {/* same exact-numbers list pattern as the revenue panel — the
                  chart's bar labels are compact (7.3M), this carries full
                  precision plus the detail field the tooltip also shows */}
              <ul className="list-plain">
                {topProducts.map((row) => (
                  <li key={row.productName} className="list-row">
                    {row.productName}: {row.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' '}({row.totalQuantity.toLocaleString('en-US')} units)
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <h2>Top payers</h2>
          {!topPayersLoading && !topPayersError && (
            <>
              <TopBarChart
                data={topPayers}
                xKey="insurance"
                barKey="totalRevenue"
                detailKey="totalOrders"
                detailLabel="Orders"
              />
              <ul className="list-plain">
                {topPayers.map((row) => (
                  <li key={row.insurance} className="list-row">
                    {row.insurance}: {row.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' '}({row.totalOrders.toLocaleString('en-US')} orders)
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <h2>Expiring stock</h2>

          {/* local to just this panel, not the shared date range above */}
          <div className="controls">
            <label htmlFor="expiring-after" className="kpi-label">Expiring between</label>
            <input
              id="expiring-after"
              type="date"
              value={expiringAfter}
              onChange={(e) => setExpiringAfter(e.target.value)}
            />
            <label htmlFor="expiring-before" className="kpi-label">and</label>
            <input
              id="expiring-before"
              type="date"
              value={expiringBefore}
              onChange={(e) => setExpiringBefore(e.target.value)}
            />
          </div>

          {expiringLoading && <p>Loading…</p>}
          {expiringError && <p>Error: {expiringError}</p>}
          {!expiringLoading && !expiringError && expiringStock.length === 0 && (
            <p className="kpi-label">Nothing expiring by this date.</p>
          )}
          {!expiringLoading && !expiringError && expiringStock.length > 0 && (
            <>
              {/* only the 6 soonest-expiring lots in the chart — the full
                  list below (scrollable) carries everything else */}
              <TopBarChart
                data={expiringWithPct.slice(0, 6)}
                xKey="itemName"
                barKey="pctRemaining"
                detailKey="expirationDate"
                detailLabel="Expires"
                labelFormatter={(v) => `${v.toFixed(0)}%`}
                valueFormatter={(v) => `${v.toFixed(0)}% left`}
              />
              <ul className="scroll-list">
                {expiringWithPct.map((row) => {
                  // high % remaining + close to expiring = waste risk — the
                  // OPPOSITE direction from the low-stock "Reorder" flag
                  // elsewhere, so a separate class (same red style)
                  const wasteRisk = row.pctRemaining >= 50;
                  return (
                    <li key={`${row.itemName}-${row.batchNumber}`} className="list-row">
                      {row.itemName}: expires {row.expirationDate}
                      {' '}(live {row.quantity} / initial {row.initialQuantity},{' '}
                      <span className={wasteRisk ? 'pct-alert' : ''}>
                        {row.pctRemaining.toFixed(0)}% left
                        {wasteRisk && ' — waste risk'}
                      </span>
                      )
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Full-width panel, deliberately OUTSIDE .dashboard-grid — a table of
          50 rows doesn't belong squeezed into a ~400px grid column the way
          the charts do; it needs the whole page width to stay readable. */}
      <section className="card">
        <h2>Top movers — units sold</h2>
        {topMoversLoading && <p>Loading…</p>}
        {topMoversError && <p>Error: {topMoversError}</p>}
        {!topMoversLoading && !topMoversError && topMovers.length === 0 && (
          <p className="kpi-label">No data for this range.</p>
        )}
        {!topMoversLoading && !topMoversError && topMovers.length > 0 && (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Units sold</th>
                <th>Initial qty</th>
                <th>Live qty</th>
                <th>% remaining</th>
                <th>Documented date</th>
                <th>Avg price</th>
                <th>Revenue</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {topMovers.map((row) => {
                // % remaining = current lot quantity / what that lot started
                // with. Null when a product has sales but no matching stock
                // lot (the LEFT JOIN on the backend found nothing) — shown as
                // "—" rather than crashing on a null initialQuantity.
                const pctRemaining =
                  row.initialQuantity ? (row.liveQuantity / row.initialQuantity) * 100 : null;
                const low = pctRemaining !== null && pctRemaining < 30;

                return (
                  <tr key={row.productName}>
                    <td>{row.productName}</td>
                    <td>{row.totalQuantity.toLocaleString('en-US')}</td>
                    <td>{row.initialQuantity ?? '—'}</td>
                    <td>{row.liveQuantity ?? '—'}</td>
                    {/* red is never the only signal — "Reorder" is the real
                        flag; color just makes it faster to spot at a glance */}
                    <td className={low ? 'pct-low' : ''}>
                      {pctRemaining !== null ? `${pctRemaining.toFixed(0)}%` : '—'}
                      {low && ' — Reorder'}
                    </td>
                    <td>{row.idLot ?? '—'}</td>
                    <td>
                      {(row.totalRevenue / row.totalQuantity).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      {row.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      {row.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
