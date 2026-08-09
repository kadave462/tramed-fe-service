import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatCompact, weekdayLabel } from '../utils/format';

const axisTickStyle = { fill: '#898781', fontSize: 12 };

// A presentational component: given the revenue array, it draws the chart.
// It doesn't fetch anything — from/to stay in Dashboard.jsx, which owns the
// data and just hands it down as a prop. groupBy IS needed here though,
// just to decide how to label each point: only 'day' periods parse as a
// weekday, every other granularity keeps its raw period string.
function RevenueChart({ data, groupBy }) {
  // A successful fetch that just happens to return zero rows (e.g. a future
  // date range with no sales yet) is not an error — but an empty chart with
  // no explanation reads as broken, so say so directly instead.
  if (data.length === 0) {
    return <p className="kpi-label">No revenue data for this range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ left: 20 }}>
        {/* hairline, solid, horizontal-only grid — vertical lines add
            clutter without carrying any extra information here */}
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={groupBy === 'day' ? weekdayLabel : undefined}
          tick={axisTickStyle}
          tickLine={false}
          axisLine={{ stroke: '#c3c2b7' }}
        />
        <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
        <Tooltip
          labelFormatter={groupBy === 'day' ? weekdayLabel : undefined}
          formatter={(value) =>
            value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          }
          contentStyle={{
            background: '#fcfcfb',
            border: '1px solid rgba(11,11,11,0.10)',
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        {/* two series now (revenue + profit) means a legend is required —
            it's the dependable way to tell them apart, direct color alone
            isn't enough once there's more than one line */}
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#2a78d6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
        />
        {/* profit rides on the same fetched rows — the backend query now
            returns cost/profit alongside revenue, so no second request was
            needed to add this line. Second categorical slot (orange), same
            palette ordering used everywhere else in the app. */}
        <Line
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke="#eb6834"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default RevenueChart;
