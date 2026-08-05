import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import { formatCompact } from '../utils/format';

const axisTickStyle = { fill: '#898781', fontSize: 12 };

// Custom tooltip content, instead of Tooltip's built-in `formatter`. The
// built-in formatter only ever sees the single field plotted on the Bar
// (barKey) — it has no way to reach a sibling field on the same row. This
// function receives the whole data row (payload[0].payload), so it can show
// a second, unplotted field (detailKey) alongside the revenue number.
function renderTooltip({ active, payload, label, detailKey, detailLabel }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      <div>{payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      {detailKey && (
        <div className="chart-tooltip-detail">
          {detailLabel}: {row[detailKey].toLocaleString('en-US')}
        </div>
      )}
    </div>
  );
}

// A reusable bar chart. It doesn't know or care whether it's showing
// products or payers — the caller tells it which field goes on the
// X axis (xKey), which field the bars are drawn from (barKey), and
// optionally a second field (detailKey/detailLabel) to surface in the
// tooltip for extra context — e.g. units sold, or number of orders.
function TopBarChart({ data, xKey, barKey, detailKey, detailLabel }) {
  // same reasoning as RevenueChart — an empty array from a successful fetch
  // (no sales in this range) is not an error, but a blank chart looks like one
  if (data.length === 0) {
    return <p className="kpi-label">No data for this range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: 20, top: 20 }}>
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={axisTickStyle}
          tickLine={false}
          axisLine={{ stroke: '#c3c2b7' }}
          angle={-20}
          textAnchor="end"
          height={70}
          interval={0}
        />
        <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
        <Tooltip content={(props) => renderTooltip({ ...props, detailKey, detailLabel })} />
        {/* barSize caps the thickness so bars never balloon to fill the
            slot; radius rounds only the top corners (data-end), square
            at the baseline */}
        <Bar dataKey={barKey} fill="#2a78d6" barSize={24} radius={[4, 4, 0, 0]}>
          {/* direct label at the tip of each bar — this is the whole ask:
              show the actual number instead of making people hover for it.
              Compact notation (6.2M) keeps it from overflowing a 24px-wide bar. */}
          <LabelList
            dataKey={barKey}
            position="top"
            formatter={formatCompact}
            style={{ fill: '#52514e', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default TopBarChart;
