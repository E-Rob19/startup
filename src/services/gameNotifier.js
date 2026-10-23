// Mock of the WebSocket connection that will push live game events from the
// server. For now, fake players "finish rounds" every few seconds, and the
// player's own finished rounds are broadcast through the same channel.
import { SEED_SCORES, saveScore } from './scoreService';

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
  const player = SEED_SCORES[Math.floor(Math.random() * SEED_SCORES.length)];
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
    this.timeoutId = setTimeout(async () => {
      this.timeoutId = null;
      const round = makeFakeRound();
      await saveScore(round); // the "server" stores it before telling everyone
      this.broadcastEvent(GameEvent.RoundFinished, round);

      // Keep going only if someone is still listening and no new chain has started.
      if (this.handlers.length > 0 && this.timeoutId === null) {
        this.scheduleFakeEvent();
      }
    }, delay);
  }
}

export const GameNotifier = new GameEventNotifier();
