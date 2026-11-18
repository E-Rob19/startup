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

// The built React app (Vite's dist/ output) is copied here when deploying.
// Using __dirname makes the path work no matter which folder node is started from.
const publicDir = path.join(__dirname, 'public');

// The port can be passed on the command line (`node index.js 4000`).
// 4000 is the startup's port by course convention (Simon uses 3000).
const port = process.argv.length > 2 ? process.argv[2] : 4000;

// The live site uses the 'earshot' database. `npm run dev` adds --dev
// (`node index.js 4000 --dev`) to use 'earshot-dev', so local testing stays
// separate. It's an explicit flag rather than "whatever the next argument is"
// because the server's pm2 setup passes its own extra argument (the service
// name, 'startup'), which once quietly became the live database's name.
const dbName = process.argv.includes('--dev') ? 'earshot-dev' : 'earshot';

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
apiRouter.get('/scores', async (_req, res) => {
  res.send(await DB.getLeaderboard());
});

// Restricted: the logged-in player's own rounds. There's no ?name= parameter;
// "mine" always means req.user, so nobody can ask for someone else's history.
// Newest first; the newest few rounds also include their `tones`.
apiRouter.get('/scores/mine', verifyAuth, async (req, res) => {
  res.send(await DB.getScoresByName(req.user.userName));
});

// Restricted: save a finished round. The client sends what happened on each
// tone ({ tones: [{ target, guess, timeMs }, ...] }) and the server computes
// the score itself, so posting a made-up score doesn't work. The name and date
// are set here too, so a player can only post rounds as themselves.
apiRouter.post('/score', verifyAuth, async (req, res) => {
  const { tones } = req.body ?? {};
  if (!isValidRound(tones)) {
    return res.status(400).send({ msg: 'Invalid round.' });
  }

  const { score, accuracy, avgTimeMs } = scoreRound(tones);
  const date = new Date();
  const entry = { name: req.user.userName, score, accuracy, avgTimeMs };

  // Saved to MongoDB with the per-tone results. Each tone is rebuilt with only
  // the known fields, so extra junk sent in the request isn't stored.
  await DB.addScore({
    ...entry,
    date,
    tones: tones.map(({ target, guess, timeMs, withNoise, timedOut }) => ({
      target,
      guess,
      timeMs,
      withNoise,
      timedOut,
    })),
  });

  // Same shape as before (no _id, no tones), so the Game page is unchanged.
  res.send({ ...entry, date: date.toISOString() });
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
  // Atlas unreachable (or the client closed) isn't a bug in our code, so it
  // gets a short log line and 503 Service Unavailable instead of a 500.
  // A 503 (not 401) also means the frontend won't log the player out just
  // because the database blinked during verifyAuth.
  if (DB.isDatabaseUnavailable(err)) {
    console.error(`Database unavailable: ${err.name}: ${err.message}`);
    return res.status(503).send({ msg: 'The database is unavailable right now. Please try again in a moment.' });
  }

  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).send({ msg: status === 500 ? 'Something went wrong on the server.' : 'Invalid request.' });
});

// Connect to MongoDB first, and only start accepting requests once that works.
// If it fails, there's no point running: every endpoint needs the database.
// Only the error message is logged, never the connection URL (it contains the password).
let httpServer;
DB.connect(dbName)
  .then(() => {
    console.log(`Connected to MongoDB (${dbName})`);
    httpServer = app.listen(port, () => {
      console.log(`EarShot service listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error(`Unable to connect to MongoDB (${dbName}): ${err.message}`);
    process.exit(1);
  });

// Clean shutdown. pm2 sends SIGINT on `pm2 restart`/`pm2 stop` (and Ctrl+C
// does too); SIGTERM is the other standard "please stop" signal. Without
// these, Node just dies mid-request with MongoDB connections left open.
const SHUTDOWN_TIMEOUT_MS = 1000; // pm2 force-kills after 1.6 s by default

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);

  // If a connection refuses to finish, give up rather than hang.
  setTimeout(() => {
    console.error('Shutdown took too long; exiting anyway.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref(); // unref: this timer alone doesn't keep Node running

  // Stop accepting new requests, and wait for the ones in progress to finish...
  if (httpServer) {
    const closed = new Promise((resolve) => httpServer.close(resolve));
    // close() waits for every connection to end, but browsers keep a
    // connection open after a request finishes ("keep-alive") to reuse it.
    // Close connections as soon as they're idle so close() can finish.
    httpServer.closeIdleConnections();
    const idleCloser = setInterval(() => httpServer.closeIdleConnections(), 50);
    await closed;
    clearInterval(idleCloser);
  }
  // ...then close the MongoDB connection pool.
  await DB.close();
  console.log('HTTP server and MongoDB connection closed.');
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
