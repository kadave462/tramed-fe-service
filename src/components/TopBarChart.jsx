import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import { formatCompact } from '../utils/format';

const axisTickStyle = { fill: '#898781', fontSize: 12 };

const defaultMoneyFormat = (value) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// detailKey can point at a number (totalQuantity, totalOrders — existing
// usages) or a string (expirationDate — the new one). Numbers get comma
// formatting; strings can't call toLocaleString the way numbers can, so
// they're shown as-is.
const defaultDetailFormat = (value) => (typeof value === 'number' ? value.toLocaleString('en-US') : value);

// Custom tooltip content, instead of Tooltip's built-in `formatter`. The
// built-in formatter only ever sees the single field plotted on the Bar
// (barKey) — it has no way to reach a sibling field on the same row. This
// function receives the whole data row (payload[0].payload), so it can show
// a second, unplotted field (detailKey) alongside the main number.
function renderTooltip({ active, payload, label, detailKey, detailLabel, valueFormatter }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      <div>{valueFormatter(payload[0].value)}</div>
      {detailKey && (
        <div className="chart-tooltip-detail">
          {detailLabel}: {defaultDetailFormat(row[detailKey])}
        </div>
      )}
    </div>
  );
}

// A reusable bar chart. It doesn't know or care whether it's showing
// products, payers, or a percentage — the caller tells it which field goes
// on the X axis (xKey), which field the bars are drawn from (barKey), and
// optionally a second field (detailKey/detailLabel) to surface in the
// tooltip for extra context. labelFormatter/valueFormatter default to the
// money-style formatting every existing usage relies on, so passing neither
// changes nothing — only the new percentage chart overrides them.
function TopBarChart({
  data,
  xKey,
  barKey,
  detailKey,
  detailLabel,
  labelFormatter = formatCompact,
  valueFormatter = defaultMoneyFormat,
  // optional: (row) => a CSS color string. When given, each bar is colored
  // individually based on its own row instead of every bar sharing the one
  // fixed blue fill — used by Expiring stock to flag high-%-remaining lots
  // red and low ones green, on top of the label most other charts don't need.
  colorForRow,
}) {
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
        <YAxis tickFormatter={labelFormatter} tick={axisTickStyle} tickLine={false} axisLine={false} />
        <Tooltip content={(props) => renderTooltip({ ...props, detailKey, detailLabel, valueFormatter })} />
        {/* barSize caps the thickness so bars never balloon to fill the
            slot; radius rounds only the top corners (data-end), square
            at the baseline */}
        <Bar dataKey={barKey} fill="#2a78d6" barSize={24} radius={[4, 4, 0, 0]}>
          {/* Cell overrides ONE bar's fill each, in the same order as `data`.
              Only rendered when the caller passes colorForRow — everything
              else keeps the single fixed blue fill from Bar's own `fill` above. */}
          {colorForRow &&
            data.map((row, i) => <Cell key={`cell-${i}`} fill={colorForRow(row)} />)}
          {/* direct label at the tip of each bar — this is the whole ask:
              show the actual number instead of making people hover for it. */}
          <LabelList
            dataKey={barKey}
            position="top"
            formatter={labelFormatter}
            style={{ fill: '#52514e', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default TopBarChart;
