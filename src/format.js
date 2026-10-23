// Display formatting shared by the game, leaderboard, and profile.

// 0.874 → "87%"
export function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

// 2345 → "2.3s"
export function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

// "2026-10-22T18:00:00.000Z" → "10/22/2026" (in the viewer's own locale)
export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString();
}
