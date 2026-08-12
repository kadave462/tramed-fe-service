import { useState, useEffect } from 'react';
import RevenueChart from '../components/RevenueChart';
import TopBarChart from '../components/TopBarChart';
import { weekdayLabel } from '../utils/format';

const API = 'https://david-api-la1t.onrender.com';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
// below this many estimated days-of-stock-left (at the current depletion
// pace), a lot gets flagged "Reorder" — replaces a flat "% remaining"
// cutoff, which couldn't tell a lot that's genuinely about to run out from
// one that's just small and barely selling (see TRIALGIC: 29% remaining
// but ~9 months to get there — not urgent at that pace).
const REORDER_DAYS_THRESHOLD = 7;

// Must match --danger/--good in index.css. Kept as separate JS constants
// rather than reading the CSS variables at runtime, because Recharts sets
// Cell's fill as a raw SVG attribute — var() there isn't reliable the way
// it is in a normal style property, so a plain hex string is the safe bet.
const DANGER_COLOR = '#d03b3b';
const GOOD_COLOR = '#2f9e44';

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

// idLot ("Documented date") is a 6-digit YYMMDD string, e.g. "251112" =
// 2025-11-12 — confirmed against the pharmacy's own sale records.
function parseDocumentedDate(idLot) {
  if (!idLot || idLot.length !== 6) return null;
  const yy = parseInt(idLot.slice(0, 2), 10);
  const mm = parseInt(idLot.slice(2, 4), 10);
  const dd = parseInt(idLot.slice(4, 6), 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  return new Date(2000 + yy, mm - 1, dd);
}

function Dashboard() {
  //  the 3 memory slots
  const [revenue, setRevenue] = useState([]);    // the data — starts empty
  const [loading, setLoading] = useState(true);  // still fetching?
  const [error, setError] = useState(null);      // did it fail?

  //  the 3 new memory slots — what the user controls. Defaults to the last
  //  7 days through today, grouped by day — same range/granularity as the
  //  "7 days ago" preset below, just applied on load instead of requiring
  //  a click.
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  });
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [groupBy, setGroupBy] = useState('day');

  //  the cutoff date for the "By this date" control below — its own state
  //  since it's a specific date, not one of the 5 fixed presets. Defaults
  //  to today-2 days: today's own figures are usually still incomplete
  //  (sales still coming in), so a 2-day-old cutoff is safer as a first look.
  const [byThisDate, setByThisDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return toISODate(d);
  });

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

  // Column sort for the Top movers table. null key = default order (the
  // API's own order, units sold descending) — that's also what the #
  // rank column is fixed to, so sorting by another column re-orders the
  // rows on screen without renumbering who's "the #1 mover".
  const [moversSortKey, setMoversSortKey] = useState(null);
  const [moversSortDir, setMoversSortDir] = useState('asc');

  //  expiring stock has its OWN date range (not the shared from/to above) —
  //  defaults to today through 1 MONTH out (was 1 year), so the panel opens
  //  showing what's genuinely coming up soon, not the entire next year.
  const [expiringAfter, setExpiringAfter] = useState(() => toISODate(new Date()));
  const [expiringBefore, setExpiringBefore] = useState(() => {
    const oneMonthOut = new Date();
    oneMonthOut.setMonth(oneMonthOut.getMonth() + 1);
    return toISODate(oneMonthOut);
  });
  const [expiringStock, setExpiringStock] = useState([]);
  const [expiringLoading, setExpiringLoading] = useState(true);
  const [expiringError, setExpiringError] = useState(null);

  // Quick presets for the main from/to/groupBy controls. Sets state directly
  // rather than returning values, since from/to/groupBy already live as
  // separate useState calls above — this is just a shortcut for setting all
  // 2-3 of them together instead of clicking two date inputs by hand.
  function applyDatePreset(preset) {
    const today = new Date();
    const todayISO = toISODate(today);
    if (preset === 'today') {
      setFrom(todayISO);
      setTo(todayISO);
      setGroupBy('day');
    } else if (preset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = toISODate(yesterday);
      setFrom(yesterdayISO);
      setTo(yesterdayISO);
      setGroupBy('day');
    } else if (preset === '7days') {
      const sevenAgo = new Date(today);
      sevenAgo.setDate(sevenAgo.getDate() - 7);
      setFrom(toISODate(sevenAgo));
      setTo(todayISO);
      setGroupBy('day');
    } else if (preset === 'thisMonth') {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setFrom(toISODate(firstOfMonth));
      setTo(todayISO);
      setGroupBy('day');
    } else if (preset === 'year') {
      const jan1 = new Date(today.getFullYear(), 0, 1);
      setFrom(toISODate(jan1));
      setTo(todayISO);
      // opposite of the other 4 presets: a year-wide range grouped by day
      // would be hundreds of unreadable bars, so Year switches to 'month'
      // instead — Today/Yesterday/7 days ago/This month all switch to 'day',
      // since their ranges are short enough that day-level detail is exactly
      // the point (and weekday names only render in that mode).
      setGroupBy('month');
    }
  }

  // "By this date" — sets the shared from/to/groupBy from the byThisDate
  // input above. groupBy 'month-to-date' is a distinct backend query, not a
  // client-side filter — see revenuePeriodByMonthToDate in
  // FactSaleRepository; it caps every month in range to days
  // 1-through-day-of-month(:to), :to being whatever date is picked here.
  function applyByThisDate(dateStr) {
    setByThisDate(dateStr);
    const year = parseInt(dateStr.slice(0, 4), 10);
    setFrom(toISODate(new Date(year, 0, 1)));
    setTo(dateStr);
    setGroupBy('month-to-date');
  }

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

  //  fetches top-products AND top-payers together via Promise.all — both
  //  requests fire at once instead of one waiting for the previous one.
  //  Only depends on [from, to], not groupBy — neither endpoint takes one.
  //  top-movers used to be a third request bundled in here too, but it's
  //  all-time now (doesn't use from/to at all) and its query is genuinely
  //  slow (~8s, scanning the full sales history instead of a date-scoped
  //  slice) — bundling it meant EVERY date-range change anywhere on the
  //  page re-ran that 8s query for no reason, and the Top movers table
  //  unmounted (showed "Loading…") each time, which could eat a sort-header
  //  click if it landed mid-reload. Split into its own effect below with an
  //  empty dependency array, so it only ever fetches once, on mount.
  useEffect(() => {
    async function loadTopLists() {
      try {
        setTopProductsLoading(true);
        setTopPayersLoading(true);
        const [productsRes, payersRes] = await Promise.all([
          fetch(`${API}/api/v1/analytics/top-products?from=${from}&to=${to}`),
          fetch(`${API}/api/v1/analytics/top-payers?from=${from}&to=${to}`),
        ]);
        if (!productsRes.ok) throw new Error(`HTTP ${productsRes.status}`);
        if (!payersRes.ok) throw new Error(`HTTP ${payersRes.status}`);
        const productsData = await productsRes.json();
        const payersData = await payersRes.json();
        setTopProducts(productsData);
        setTopPayers(payersData);
      } catch (err) {
        setTopProductsError(err.message);
        setTopPayersError(err.message);
      } finally {
        setTopProductsLoading(false);
        setTopPayersLoading(false);
      }
    }
    loadTopLists();
  }, [from, to]);

  //  all-time, fetched once on mount — see the comment above for why this
  //  is split out from top-products/top-payers instead of sharing their
  //  [from, to]-keyed effect. 20000 is comfortably above the entire product
  //  catalog (~16,809 products) — the query can only ever return one row
  //  per product with any sale, ever, so this limit can never be the thing
  //  truncating the list.
  useEffect(() => {
    async function loadTopMovers() {
      try {
        setTopMoversLoading(true);
        const res = await fetch(`${API}/api/v1/analytics/top-movers?limit=20000`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTopMovers(data);
      } catch (err) {
        setTopMoversError(err.message);
      } finally {
        setTopMoversLoading(false);
      }
    }
    loadTopMovers();
  }, []);

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
    // backend returns a full ISO timestamp (e.g. "2027-01-28T00:00:00.000Z")
    // for what's really just a date — drop everything from "T" onward
    expirationDate: row.expirationDate?.split('T')[0],
    // capped at 100 — same "INVENTAIRE" correction case as topMoversRanked
    // below, where an inventory-count adjustment can raise live quantity
    // above the source's recorded initial count
    pctRemaining: row.initialQuantity ? Math.min(100, (row.quantity / row.initialQuantity) * 100) : 0,
    // quantity still live at cost = what's actually lost if this lot expires
    // unsold. unitCost can be null (not every staging_stock row has one
    // recorded) — lostValue stays null too rather than silently showing 0.
    lostValue: row.unitCost != null ? row.quantity * row.unitCost : null,
  }));

  // total money at risk across every lot currently in the expiringAfter/
  // expiringBefore range — nulls (missing unitCost) contribute 0, same as
  // the rest of this codebase's ?? 0 pattern for "unknown, not zero, but
  // can't let it break a sum".
  const totalExpiringCost = expiringWithPct.reduce((sum, row) => sum + (row.lostValue ?? 0), 0);

  // "Units sold" totals aren't comparable across products as a speed
  // ranking — a tablet product racks up quantity in individual pills while
  // a syrup racks it up in whole bottles (confirmed against the pharmacy's
  // own sale records), so raw quantity conflates "sells in small units"
  // with "sells fast". depletionRatePerDay fixes both that AND the
  // old-lot problem: it's the % of the CURRENT lot consumed per day since
  // it was documented — a plain percentage, so a pill lot and a bottle lot
  // are directly comparable, and a slow-but-heavily-depleted lot (TRIALGIC:
  // 29% remaining over ~9 months) no longer reads as "fast" just because
  // little is left. daysRemaining (lot size ÷ that pace) drives the
  // Reorder flag below instead of a flat % cutoff.
  //
  // rows with no idLot (no matching stock lot at all — a LEFT JOIN miss on
  // the backend, confirmed via the pharmacy's local database to mean
  // "genuinely no stock lot," not a sync gap) are dropped entirely rather
  // than shown with "—" placeholders.
  //
  // rank is assigned AFTER sorting by depletion rate — #1 is the fastest
  // mover by this measure, not the highest raw quantity. Sorting the table
  // by another column re-orders what's on screen but never renumbers this
  // column, same as before.
  const topMoversRanked = topMovers
    .filter((row) => row.idLot != null)
    .map((row) => {
      // capped at 100: initialQuantity is the source system's recorded
      // starting count, but an inventory-count correction (supplierName
      // "INVENTAIRE") can raise liveQuantity above it without the source
      // ever updating that starting count — confirmed on METFORMINE SR
      // 1000mg (item 15716), live 40 vs initial 30. Showing "133% remaining"
      // is nonsensical; capping treats it as fully stocked instead.
      const pctRemaining = row.initialQuantity
        ? Math.min(100, (row.liveQuantity / row.initialQuantity) * 100)
        : null;
      const avgPrice = row.totalQuantity ? row.totalRevenue / row.totalQuantity : null;

      const documentedDate = parseDocumentedDate(row.idLot);
      let depletionRatePerDay = null;
      let daysRemaining = null;
      if (documentedDate && row.initialQuantity) {
        const daysSince = Math.max(1, Math.round((Date.now() - documentedDate.getTime()) / MS_PER_DAY));
        const unitsSold = Math.max(0, row.initialQuantity - row.liveQuantity);
        const unitsPerDay = unitsSold / daysSince;
        depletionRatePerDay = (unitsSold / row.initialQuantity / daysSince) * 100;
        daysRemaining = unitsPerDay > 0 ? row.liveQuantity / unitsPerDay : null;
      }

      return {
        ...row,
        pctRemaining,
        avgPrice,
        depletionRatePerDay,
        daysRemaining,
        // backend sends full ISO timestamps for both — trim to plain dates,
        // same trick as expiringWithPct above.
        expirationDate: row.expirationDate?.split('T')[0],
        lastSale: row.lastSale?.slice(0, 10),
      };
    })
    .sort((a, b) => (b.depletionRatePerDay ?? -1) - (a.depletionRatePerDay ?? -1))
    .map((row, i) => ({ ...row, rank: i + 1 }));

  const moverColumns = [
    { key: 'itemId', label: 'Item ID' },
    { key: 'productName', label: 'Product' },
    { key: 'totalQuantity', label: 'Units sold' },
    { key: 'initialQuantity', label: 'Initial qty' },
    { key: 'liveQuantity', label: 'Live qty' },
    { key: 'pctRemaining', label: '% remaining' },
    { key: 'depletionRatePerDay', label: '% of lot sold / day' },
    { key: 'daysRemaining', label: 'Days remaining' },
    { key: 'idLot', label: 'Documented date' },
    { key: 'expirationDate', label: 'Expiration date' },
    { key: 'lastSale', label: 'Last sale' },
    { key: 'cost', label: 'Cost' },
    { key: 'avgPrice', label: 'Avg price' },
    { key: 'totalRevenue', label: 'Revenue' },
    { key: 'profit', label: 'Profit' },
  ];

  // click same header again to flip direction; click a different header to
  // sort by it, starting ascending. Nulls (missing stock-lot match) always
  // sort to the bottom regardless of direction, rather than jumping to
  // whichever end "0"/empty-string would land on.
  function handleMoversSort(key) {
    if (moversSortKey === key) {
      setMoversSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setMoversSortKey(key);
      setMoversSortDir('asc');
    }
  }

  const sortedMovers = moversSortKey
    ? [...topMoversRanked].sort((a, b) => {
        const av = a[moversSortKey];
        const bv = b[moversSortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
        return moversSortDir === 'asc' ? cmp : -cmp;
      })
    : topMoversRanked;

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
          <option value="month-to-date">Month, by this date</option>
          <option value="year">Year</option>
        </select>
        {/* quick presets — each just calls setFrom/setTo(/setGroupBy) under
            the hood, same state the two date inputs above already control */}
        <button type="button" className="preset-btn" onClick={() => applyDatePreset('today')}>Today</button>
        <button type="button" className="preset-btn" onClick={() => applyDatePreset('yesterday')}>Yesterday</button>
        <button type="button" className="preset-btn" onClick={() => applyDatePreset('7days')}>7 days ago</button>
        <button type="button" className="preset-btn" onClick={() => applyDatePreset('thisMonth')}>This month</button>
        <button type="button" className="preset-btn" onClick={() => applyDatePreset('year')}>Year</button>
        {/* "By this date" is a date picker + explicit Search button, not a
            one-click preset — picking a date only updates byThisDate, it
            doesn't touch the chart until Search is clicked, so typing/
            scrolling through the calendar doesn't fire a fetch per keystroke */}
        <label className="preset-btn">
          By this date{' '}
          <input
            type="date"
            value={byThisDate}
            onChange={(e) => setByThisDate(e.target.value)}
          />
        </label>
        <button type="button" className="preset-btn" onClick={() => applyByThisDate(byThisDate)}>
          Search
        </button>
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
                <RevenueChart data={revenue} groupBy={groupBy} />
              </div>

              {/* the exact numbers, scrollable so a long day-by-day list doesn't
                  push the page height around */}
              <ul className="scroll-list scroll-list--tight">
                {revenue.map((row) => (
                  <li key={row.period} className="list-row">
                    {groupBy === 'day' ? weekdayLabel(row.period) : row.period}:{' '}
                    {row.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            {/* everything already expired, as of today — after is set wide
                open (the backend's own >= 2020-01-01 floor still applies),
                before is today itself: the backend query's BETWEEN is
                inclusive on both ends, so today counts as still expiring,
                not yet past it */}
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                setExpiringAfter('2000-01-01');
                setExpiringBefore(toISODate(new Date()));
              }}
            >
              Expired stock
            </button>
          </div>

          {expiringLoading && <p>Loading…</p>}
          {expiringError && <p>Error: {expiringError}</p>}
          {!expiringLoading && !expiringError && expiringStock.length === 0 && (
            <p className="kpi-label">Nothing expiring by this date.</p>
          )}
          {!expiringLoading && !expiringError && expiringStock.length > 0 && (
            <>
              {/* whole-range total, not per-lot — everything currently
                  between expiringAfter and expiringBefore, valued at cost */}
              <p className="kpi-label">
                Total cost of expiring stock before {expiringBefore}:{' '}
                <span className="kpi-value">
                  {totalExpiringCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF
                </span>
              </p>

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
                // high % remaining this close to expiring = waste risk (red);
                // below the threshold = fine (green) — opposite direction
                // from the low-stock "Reorder" flag in Top movers below
                colorForRow={(row) => (row.pctRemaining >= 50 ? DANGER_COLOR : GOOD_COLOR)}
              />
              <ul className="scroll-list">
                {expiringWithPct.map((row) => {
                  const wasteRisk = row.pctRemaining >= 50;
                  return (
                    <li key={`${row.itemName}-${row.batchNumber}`} className="list-row">
                      {row.itemName}: expires {row.expirationDate}
                      {' '}(live {row.quantity} / initial {row.initialQuantity},{' '}
                      <span className={wasteRisk ? 'pct-alert' : 'pct-good'}>
                        {row.pctRemaining.toFixed(0)}% left
                      </span>
                      {row.lostValue != null && (
                        <>
                          {', '}
                          {row.lostValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {' RWF'}
                        </>
                      )}
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
          100 rows doesn't belong squeezed into a ~400px grid column the way
          the charts do; it needs the whole page width to stay readable. */}
      <section className="card">
        <h2>Top movers — ranked by % of current lot sold per day</h2>
        {topMoversLoading && <p>Loading…</p>}
        {topMoversError && <p>Error: {topMoversError}</p>}
        {!topMoversLoading && !topMoversError && topMovers.length === 0 && (
          <p className="kpi-label">No data for this range.</p>
        )}
        {!topMoversLoading && !topMoversError && topMovers.length > 0 && (
          <div className="table-scroll">
          <table className="table-compact">
            <thead>
              <tr>
                <th>#</th>
                {moverColumns.map((col) => (
                  <th key={col.key} className="sortable" onClick={() => handleMoversSort(col.key)}>
                    {col.label}
                    {moversSortKey === col.key && (moversSortDir === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMovers.map((row) => {
                // Reorder now fires off estimated days-of-stock-left at the
                // lot's actual depletion pace, not a flat % cutoff — see the
                // comment above topMoversRanked for why (TRIALGIC).
                const low = row.daysRemaining !== null && row.daysRemaining < REORDER_DAYS_THRESHOLD;

                return (
                  <tr key={row.productName}>
                    <td>{row.rank}</td>
                    <td>{row.itemId ?? '—'}</td>
                    <td>{row.productName}</td>
                    <td>{row.totalQuantity.toLocaleString('en-US')}</td>
                    <td>{row.initialQuantity ?? '—'}</td>
                    <td>{row.liveQuantity ?? '—'}</td>
                    <td>{row.pctRemaining !== null ? `${row.pctRemaining.toFixed(0)}%` : '—'}</td>
                    {/* red is never the only signal — "Reorder" is the real
                        flag; color just makes it faster to spot at a glance */}
                    <td className={low ? 'pct-low' : ''}>
                      {row.depletionRatePerDay !== null ? `${row.depletionRatePerDay.toFixed(2)}%/day` : '—'}
                      {low && ' — Reorder'}
                    </td>
                    <td>{row.daysRemaining !== null ? row.daysRemaining.toFixed(1) : '—'}</td>
                    <td>{row.idLot ?? '—'}</td>
                    <td>{row.expirationDate ?? '—'}</td>
                    <td>{row.lastSale ?? '—'}</td>
                    <td>
                      {row.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      {row.avgPrice !== null
                        ? row.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '—'}
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
