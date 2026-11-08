// Score service: talks to the backend's score endpoints. The server stores
// every round and computes each score itself (see service/scoring.js).

// Thrown when the server says we're not logged in (401), e.g. the session
// expired or the server restarted. Pages catch it and log the user out.
export class UnauthorizedError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.');
    this.name = 'UnauthorizedError';
  }
}

const UNREACHABLE_MESSAGE = "Can't reach the server. Please try again in a moment.";

// 502/503/504 come from whatever sits in front of our service (Caddy in
// production, Vite's proxy in development) when the service itself is down.
const GATEWAY_ERRORS = [502, 503, 504];

async function sendScoreRequest(method, path, body) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects when the request couldn't be sent at all.
    throw new Error(UNREACHABLE_MESSAGE);
  }

  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (GATEWAY_ERRORS.includes(response.status)) {
    throw new Error(UNREACHABLE_MESSAGE);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || 'Something went wrong. Please try again.');
  }
  return data;
}

// tones: [{ target, guess, timeMs }, ...] for all 10 tones of the round.
// Returns the saved entry { name, score, accuracy, avgTimeMs, date }, with
// the score as computed by the server.
export async function saveScore(tones) {
  return sendScoreRequest('POST', 'score', { tones });
}

// Each player's best score, highest first (top 10). Anyone can see it.
export async function getLeaderboard() {
  return sendScoreRequest('GET', 'scores');
}

// Every round the logged-in player has saved, newest first. The server works
// out who "mine" is from the auth cookie, so there's no name parameter.
export async function getHistory() {
  return sendScoreRequest('GET', 'scores/mine');
}
