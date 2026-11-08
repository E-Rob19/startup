// Auth service: talks to the backend's /api/auth endpoints.
// The server checks passwords (bcrypt) and sets an httpOnly cookie that proves
// who is logged in; the browser sends that cookie automatically on every
// /api request, so this code never sees or handles the token itself.

// Only a UI hint: remembers the name so the navbar can render immediately on
// page load. The cookie is the real proof of login. Prefixed so it can't
// collide with Simon's 'userName' on localhost:5173.
const USER_NAME_KEY = 'earshot.userName';

// Who is logged in right now, or '' if nobody. Synchronous because App
// needs it immediately on startup.
export function getStoredUserName() {
  return localStorage.getItem(USER_NAME_KEY) || '';
}

// Sends a JSON request to the service. Returns the parsed response body, or
// throws an Error whose message the pages can show as-is.
async function sendAuthRequest(method, path, body) {
  let response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch itself only rejects when the request couldn't be sent at all.
    throw new Error("Can't reach the server. Please try again in a moment.");
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || 'Something went wrong. Please try again.');
  }
  return data;
}

export async function register(userName, password) {
  const user = await sendAuthRequest('POST', 'create', { userName, password });
  localStorage.setItem(USER_NAME_KEY, user.userName);
  return user;
}

export async function login(userName, password) {
  const user = await sendAuthRequest('PUT', 'login', { userName, password });
  localStorage.setItem(USER_NAME_KEY, user.userName);
  return user;
}

// Always logs out locally, even if the server can't be reached, so the
// Logout button never gets stuck.
export async function logout() {
  localStorage.removeItem(USER_NAME_KEY);
  try {
    await sendAuthRequest('DELETE', 'logout');
  } catch {
    // Ignore: the cookie is httpOnly, so the server is the only one who can
    // clear it, but the user is logged out as far as this app is concerned.
  }
}
