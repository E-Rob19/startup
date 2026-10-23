// Mock auth service. Users are kept in localStorage until the backend exists.
// Each function is async so the components can later switch to fetch() calls
// without changing how they use these.

// Keys are prefixed so they can't collide with other apps on the same origin
// (e.g. Simon, which also runs on localhost:5173 during development).
const USERS_KEY = 'earshot.users';
const USER_NAME_KEY = 'earshot.userName';

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}

// Who is logged in right now, or '' if nobody. Synchronous because App
// needs it immediately on startup.
export function getStoredUserName() {
  return localStorage.getItem(USER_NAME_KEY) || '';
}

export async function register(userName, password) {
  const users = getUsers();
  if (users[userName]) {
    throw new Error('That username is already taken.');
  }
  users[userName] = password;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(USER_NAME_KEY, userName);
  return { userName };
}

export async function login(userName, password) {
  const users = getUsers();
  if (!users[userName] || users[userName] !== password) {
    throw new Error('Incorrect username or password.');
  }
  localStorage.setItem(USER_NAME_KEY, userName);
  return { userName };
}

export async function logout() {
  localStorage.removeItem(USER_NAME_KEY);
}
