// Mock score service. Scores are kept in localStorage until the database exists.
// Like authService, every function is async so they can become fetch() calls later.

// Prefixed so it can't collide with Simon's 'scores' key on localhost:5173.
const SCORES_KEY = 'earshot.scores';
const LEADERBOARD_SIZE = 10;

// Fake players so the leaderboard isn't empty in a fresh browser.
// Also used by gameNotifier as the fake players' skill levels.
export const SEED_SCORES = [
  { name: 'frequencyfox', score: 912, accuracy: 0.95, avgTimeMs: 2800, date: '2026-09-18T19:42:00.000Z' },
  { name: 'mixmaster_jo', score: 874, accuracy: 0.92, avgTimeMs: 3400, date: '2026-09-17T15:10:00.000Z' },
  { name: 'ringout_ray', score: 851, accuracy: 0.91, avgTimeMs: 4100, date: '2026-09-15T22:05:00.000Z' },
  { name: 'gainstager', score: 803, accuracy: 0.87, avgTimeMs: 4600, date: '2026-09-14T17:30:00.000Z' },
  { name: 'sub_woofer', score: 768, accuracy: 0.85, avgTimeMs: 5200, date: '2026-09-12T20:48:00.000Z' },
  { name: 'feedback_fiona', score: 730, accuracy: 0.82, avgTimeMs: 5900, date: '2026-09-10T13:15:00.000Z' },
  { name: 'monitor_mo', score: 689, accuracy: 0.79, avgTimeMs: 6300, date: '2026-09-08T18:22:00.000Z' },
];

function writeScores(scores) {
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

// Reads every saved score. The first time (nothing saved yet), seeds the fake players.
function readScores() {
  try {
    const stored = localStorage.getItem(SCORES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Corrupted data: fall through and start over from the seed.
  }
  writeScores(SEED_SCORES);
  return [...SEED_SCORES];
}

// entry: { name, score, accuracy, avgTimeMs, date }
export async function saveScore(entry) {
  const scores = readScores();
  scores.push(entry);
  writeScores(scores);
  return entry;
}

// Each player's best score, highest first, top LEADERBOARD_SIZE only.
export async function getLeaderboard() {
  const bestByPlayer = new Map();
  for (const entry of readScores()) {
    const best = bestByPlayer.get(entry.name);
    if (!best || entry.score > best.score) {
      bestByPlayer.set(entry.name, entry);
    }
  }
  return [...bestByPlayer.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_SIZE);
}

// Every round one player has saved, newest first.
export async function getHistory(userName) {
  return readScores()
    .filter((entry) => entry.name === userName)
    .sort((a, b) => b.date.localeCompare(a.date));
}
