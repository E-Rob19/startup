// Mock of the WebSocket connection that will push live game events from the
// server. For now, fake players "finish rounds" every few seconds, and the
// player's own finished rounds are broadcast through the same channel.
//
// Fake rounds are feed-only: they are NOT saved to the server (they'd be
// rejected anyway, since saving requires being logged in as that player).

// The fake players' usual performance. Same names as the server's seed scores,
// so their live rounds look consistent with the leaderboard.
const FAKE_PLAYERS = [
  { name: 'frequencyfox', score: 912, accuracy: 0.95, avgTimeMs: 2800 },
  { name: 'mixmaster_jo', score: 874, accuracy: 0.92, avgTimeMs: 3400 },
  { name: 'ringout_ray', score: 851, accuracy: 0.91, avgTimeMs: 4100 },
  { name: 'gainstager', score: 803, accuracy: 0.87, avgTimeMs: 4600 },
  { name: 'sub_woofer', score: 768, accuracy: 0.85, avgTimeMs: 5200 },
  { name: 'feedback_fiona', score: 730, accuracy: 0.82, avgTimeMs: 5900 },
  { name: 'monitor_mo', score: 689, accuracy: 0.79, avgTimeMs: 6300 },
];

export const GameEvent = {
  RoundFinished: 'roundFinished',
};

const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 8000;
const MAX_RECENT_EVENTS = 10;
const MAX_FAKE_SCORE = 940;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// A random round for a random fake player, near that player's usual score
// (up to 120 below, 60 above), so their best scores don't creep up forever.
function makeFakeRound() {
  const player = FAKE_PLAYERS[Math.floor(Math.random() * FAKE_PLAYERS.length)];
  const score = clamp(Math.round(player.score - 120 + Math.random() * 180), 0, MAX_FAKE_SCORE);
  return {
    name: player.name,
    score,
    accuracy: clamp(player.accuracy + (score - player.score) / 1000, 0, 1),
    avgTimeMs: Math.round(player.avgTimeMs * (0.8 + Math.random() * 0.5)),
    date: new Date().toISOString(),
  };
}

class GameEventNotifier {
  events = []; // newest first
  handlers = [];
  timeoutId = null;

  // Sends an event to every listener and remembers it in the recent list.
  broadcastEvent(type, value) {
    const event = { type, value, time: new Date().toISOString() };
    this.events = [event, ...this.events].slice(0, MAX_RECENT_EVENTS);
    this.handlers.forEach((handler) => handler(event));
  }

  getRecentEvents() {
    return this.events;
  }

  // The first listener "opens the connection" and starts the fake events.
  addHandler(handler) {
    this.handlers.push(handler);
    if (this.handlers.length === 1) {
      this.scheduleFakeEvent();
    }
  }

  // The last listener leaving "closes the connection" and stops them.
  removeHandler(handler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
    if (this.handlers.length === 0) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // setTimeout (not setInterval) so each wait can be a different random length.
  scheduleFakeEvent() {
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this.broadcastEvent(GameEvent.RoundFinished, makeFakeRound());

      // Keep going only if someone is still listening and no new chain has started.
      if (this.handlers.length > 0 && this.timeoutId === null) {
        this.scheduleFakeEvent();
      }
    }, delay);
  }
}

export const GameNotifier = new GameEventNotifier();
