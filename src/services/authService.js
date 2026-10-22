// Mock auth service. Users are kept in localStorage until the backend exists.
// Each function is async so the components can later switch to fetch() calls
// without changing how they use these.

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem('users')) || {};
  } catch {
    return {};
  }
}

export async function register(userName, password) {
  const users = getUsers();
  if (users[userName]) {
    throw new Error('That username is already taken.');
  }
  users[userName] = password;
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('userName', userName);
  return { userName };
}

export async function login(userName, password) {
  const users = getUsers();
  if (!users[userName] || users[userName] !== password) {
    throw new Error('Incorrect username or password.');
  }
  localStorage.setItem('userName', userName);
  return { userName };
}

export async function logout() {
  localStorage.removeItem('userName');
}
