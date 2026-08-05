// Shortens big numbers for axis/bar labels — 14000000 -> "14M", 8500 -> "8.5K".
// Was defined identically in both RevenueChart.jsx and TopBarChart.jsx —
// pulled out once both charts needed the exact same thing.
export function formatCompact(value) {
  return value.toLocaleString('en-US', { notation: 'compact', compactDisplay: 'short' });
}
