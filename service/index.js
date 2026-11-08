const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const app = express();

const AUTH_COOKIE_NAME = 'token';
const BCRYPT_SALT_ROUNDS = 10;

// The built React app (Vite's dist/ output) is copied here when deploying.
// Using __dirname makes the path work no matter which folder node is started from.
const publicDir = path.join(__dirname, 'public');

// The port can be passed on the command line (`node index.js 4000`).
// 4000 is the startup's port by course convention (Simon uses 3000).
const port = process.argv.length > 2 ? process.argv[2] : 4000;

// In-memory data for now; MongoDB replaces this in the DB deliverable.
// Each user: { userName, passwordHash, token }
const users = [];

// Parse JSON request bodies into req.body.
app.use(express.json());

// Parse the Cookie header into req.cookies (used to find who is logged in).
app.use(cookieParser());

// Serve the frontend's static files (index.html, the JS/CSS bundles, images).
app.use(express.static(publicDir));

// Every backend endpoint lives under /api, so it can never clash with a
// frontend route like /leaderboard.
const apiRouter = express.Router();
app.use('/api', apiRouter);

// Temporary endpoint to prove the service is running.
apiRouter.get('/health', (_req, res) => {
  res.send({ ok: true });
});

// Register a new account, then log them in by setting the auth cookie.
apiRouter.post('/auth/create', async (req, res) => {
  const { userName, password } = req.body ?? {};
  if (!isNonEmptyString(userName) || !isNonEmptyString(password)) {
    return res.status(400).send({ msg: 'Username and password are required.' });
  }
  if (findUser('userName', userName)) {
    return res.status(409).send({ msg: 'That username is already taken.' });
  }

  const user = await createUser(userName, password);
  setAuthCookie(res, user.token);
  res.send({ userName: user.userName });
});

// --- Helpers ---

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// findUser('userName', 'emma') or findUser('token', req.cookies.token)
function findUser(field, value) {
  if (!value) return null;
  return users.find((user) => user[field] === value) ?? null;
}

// Only the bcrypt hash is stored, never the plain-text password.
async function createUser(userName, password) {
  const user = {
    userName,
    passwordHash: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
    token: crypto.randomUUID(),
  };
  users.push(user);
  return user;
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true, // page JavaScript can't read it, so injected scripts can't steal it
    secure: true, // only sent over HTTPS (browsers treat localhost as secure too)
    sameSite: 'strict', // not sent on requests coming from other sites
  });
}

// Any other request is a React Router page (/leaderboard, /profile, ...).
// There's no leaderboard.html file, so send index.html and let React Router
// pick the page in the browser. This must come after the static and API
// middleware so it only catches what they didn't handle.
app.use((_req, res) => {
  res.sendFile('index.html', { root: publicDir });
});

app.listen(port, () => {
  console.log(`EarShot service listening on port ${port}`);
});
