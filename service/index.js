const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { isValidRound, scoreRound } = require('./scoring');
const DB = require('./database');

const app = express();

const AUTH_COOKIE_NAME = 'token';
const BCRYPT_SALT_ROUNDS = 10;
const LEADERBOARD_SIZE = 10;

// Fake players so the leaderboard isn't empty on a freshly started server.
// (Moved here from the frontend's scoreService.js.)
const SEED_SCORES = [
  { name: 'frequencyfox', score: 912, accuracy: 0.95, avgTimeMs: 2800, date: '2026-09-18T19:42:00.000Z' },
  { name: 'mixmaster_jo', score: 874, accuracy: 0.92, avgTimeMs: 3400, date: '2026-09-17T15:10:00.000Z' },
  { name: 'ringout_ray', score: 851, accuracy: 0.91, avgTimeMs: 4100, date: '2026-09-15T22:05:00.000Z' },
  { name: 'gainstager', score: 803, accuracy: 0.87, avgTimeMs: 4600, date: '2026-09-14T17:30:00.000Z' },
  { name: 'sub_woofer', score: 768, accuracy: 0.85, avgTimeMs: 5200, date: '2026-09-12T20:48:00.000Z' },
  { name: 'feedback_fiona', score: 730, accuracy: 0.82, avgTimeMs: 5900, date: '2026-09-10T13:15:00.000Z' },
  { name: 'monitor_mo', score: 689, accuracy: 0.79, avgTimeMs: 6300, date: '2026-09-08T18:22:00.000Z' },
];

// The built React app (Vite's dist/ output) is copied here when deploying.
// Using __dirname makes the path work no matter which folder node is started from.
const publicDir = path.join(__dirname, 'public');

// The port can be passed on the command line (`node index.js 4000`).
// 4000 is the startup's port by course convention (Simon uses 3000).
const port = process.argv.length > 2 ? process.argv[2] : 4000;

// The database name can be passed next (`node index.js 4000 earshot-dev`).
// The deployed service is started without it, so it uses the live 'earshot'
// database; `npm run dev` passes 'earshot-dev' so local testing stays separate.
const dbName = process.argv.length > 3 ? process.argv[3] : 'earshot';

// Users are stored in MongoDB (see database.js).
// Rounds are still in memory until they move to MongoDB in later steps.
// Each round: { name, score, accuracy, avgTimeMs, date }
const scores = [...SEED_SCORES];

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

// Quick check that the service is up (handy after deploying).
apiRouter.get('/health', (_req, res) => {
  res.send({ ok: true });
});

// Register a new account, then log them in by setting the auth cookie.
apiRouter.post('/auth/create', async (req, res) => {
  const { userName, password } = req.body ?? {};
  if (!isNonEmptyString(userName) || !isNonEmptyString(password)) {
    return res.status(400).send({ msg: 'Username and password are required.' });
  }
  // This check handles the normal case (and skips the slow bcrypt hash)...
  if (await findUser('userName', userName)) {
    return res.status(409).send({ msg: 'That username is already taken.' });
  }

  // ...but two sign-ups at the same moment can both pass it. The unique index
  // on userName catches the second one when it tries to insert.
  let user;
  try {
    user = await createUser(userName, password);
  } catch (err) {
    if (DB.isDuplicateKeyError(err)) {
      return res.status(409).send({ msg: 'That username is already taken.' });
    }
    throw err; // anything else is a real error → error handler (500)
  }
  setAuthCookie(res, user.token);
  res.send({ userName: user.userName });
});

// Log in: check the password against the stored hash, then issue a fresh token.
apiRouter.put('/auth/login', async (req, res) => {
  const { userName, password } = req.body ?? {};
  const user = isNonEmptyString(userName) ? await findUser('userName', userName) : null;

  // Same message whether the name or the password was wrong, so the response
  // doesn't reveal which usernames exist.
  if (!user || !isNonEmptyString(password) || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).send({ msg: 'Incorrect username or password.' });
  }

  const token = crypto.randomUUID();
  await DB.setUserToken(user.userName, token);
  setAuthCookie(res, token);
  res.send({ userName: user.userName });
});

// Log out: forget the token on the server and tell the browser to drop the cookie.
// Always succeeds, even if they weren't logged in, so the frontend can call it freely.
apiRouter.delete('/auth/logout', async (req, res) => {
  const user = await findUser('token', req.cookies[AUTH_COOKIE_NAME]);
  if (user) {
    await DB.clearUserToken(user.userName);
  }
  res.clearCookie(AUTH_COOKIE_NAME);
  res.status(204).end();
});

// Middleware for restricted endpoints: only lets the request through if the
// auth cookie belongs to a logged-in user, and attaches that user as req.user.
async function verifyAuth(req, res, next) {
  const user = await findUser('token', req.cookies[AUTH_COOKIE_NAME]);
  if (!user) {
    return res.status(401).send({ msg: 'Please log in.' });
  }
  req.user = user;
  next();
}

// Restricted: who am I? The frontend uses this to check its session is still valid.
apiRouter.get('/user/me', verifyAuth, (req, res) => {
  res.send({ userName: req.user.userName });
});

// Public: the leaderboard, so guests can see it too.
apiRouter.get('/scores', (_req, res) => {
  res.send(getLeaderboard());
});

// Restricted: the logged-in player's own rounds. There's no ?name= parameter;
// "mine" always means req.user, so nobody can ask for someone else's history.
apiRouter.get('/scores/mine', verifyAuth, (req, res) => {
  const history = scores
    .filter((entry) => entry.name === req.user.userName)
    .sort((a, b) => b.date.localeCompare(a.date));
  res.send(history);
});

// Restricted: save a finished round. The client sends what happened on each
// tone ({ tones: [{ target, guess, timeMs }, ...] }) and the server computes
// the score itself, so posting a made-up score doesn't work. The name and date
// are set here too, so a player can only post rounds as themselves.
apiRouter.post('/score', verifyAuth, (req, res) => {
  const { tones } = req.body ?? {};
  if (!isValidRound(tones)) {
    return res.status(400).send({ msg: 'Invalid round.' });
  }

  const { score, accuracy, avgTimeMs } = scoreRound(tones);
  const entry = {
    name: req.user.userName,
    score,
    accuracy,
    avgTimeMs,
    date: new Date().toISOString(),
  };
  scores.push(entry);
  res.send(entry);
});

// Unknown /api path: answer with a JSON 404. Without this, the request would
// fall through to the index.html fallback below and get a 200 with HTML.
// Must stay after every apiRouter route.
apiRouter.use((req, res) => {
  res.status(404).send({ msg: `No API endpoint for ${req.method} ${req.originalUrl}.` });
});

// --- Helpers ---

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// Each player's best round, highest first, top LEADERBOARD_SIZE only.
function getLeaderboard() {
  const bestByPlayer = new Map();
  for (const entry of scores) {
    const best = bestByPlayer.get(entry.name);
    if (!best || entry.score > best.score) {
      bestByPlayer.set(entry.name, entry);
    }
  }
  return [...bestByPlayer.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_SIZE);
}

// findUser('userName', 'emma') or findUser('token', req.cookies.token)
// Resolves to the user document, or null.
//
// Only plain strings are looked up. cookie-parser turns a cookie that starts
// with "j:" into a parsed object, so a forged cookie `token=j:{"$ne":null}`
// would arrive as { $ne: null }. Passed to Mongo as-is, that means "any user
// whose token is not null", which would log the attacker in as someone else.
async function findUser(field, value) {
  if (!isNonEmptyString(value)) return null;
  return field === 'token' ? DB.getUserByToken(value) : DB.getUserByName(value);
}

// Only the bcrypt hash is stored, never the plain-text password.
async function createUser(userName, password) {
  const user = {
    userName,
    passwordHash: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
    token: crypto.randomUUID(),
  };
  await DB.addUser(user);
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

// Error handler: Express sends any thrown error (including from async
// handlers, in Express 5) here, recognizing it by the 4 parameters.
// Client mistakes like malformed JSON already carry a 4xx status; anything
// else is our bug, so log it but don't send its details to the browser.
app.use((err, _req, res, _next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).send({ msg: status === 500 ? 'Something went wrong on the server.' : 'Invalid request.' });
});

// Connect to MongoDB first, and only start accepting requests once that works.
// If it fails, there's no point running: every endpoint needs the database.
// Only the error message is logged, never the connection URL (it contains the password).
DB.connect(dbName)
  .then(() => {
    console.log(`Connected to MongoDB (${dbName})`);
    app.listen(port, () => {
      console.log(`EarShot service listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error(`Unable to connect to MongoDB (${dbName}): ${err.message}`);
    process.exit(1);
  });
