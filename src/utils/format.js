// Shortens big numbers for axis/bar labels — 14000000 -> "14M", 8500 -> "8.5K".
// Was defined identically in both RevenueChart.jsx and TopBarChart.jsx —
// pulled out once both charts needed the exact same thing.
export function formatCompact(value) {
  return value.toLocaleString('en-US', { notation: 'compact', compactDisplay: 'short' });
}

// period is "YYYY-MM-DD" only when groupBy is 'day' — parsed manually (not
// new Date(period), which reads that format as UTC midnight and can shift
// the weekday by one near timezone boundaries) into local Y/M/D, then
// formatted as "Weekday DD MM YYYY" — the raw date stays visible alongside
// the name instead of being replaced by it. Shared by RevenueChart (axis/
// tooltip) and Dashboard's revenue-by-period list, both gated on the same
// groupBy === 'day' check.
export function weekdayLabel(period) {
  const [y, m, d] = period.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${weekday} ${dd} ${mm} ${y}`;
}
