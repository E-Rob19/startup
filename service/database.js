// All MongoDB access lives in this file. index.js never talks to Mongo directly;
// it calls the functions exported here.

const {
  MongoClient,
  MongoNetworkError,
  MongoServerSelectionError,
  MongoNotConnectedError,
  MongoTopologyClosedError,
} = require('mongodb');
const config = require('./dbConfig.json'); // never committed (see .gitignore)

// encodeURIComponent keeps characters like @ : / in the username or password
// from breaking the URL.
const url =
  `mongodb+srv://${encodeURIComponent(config.userName)}:${encodeURIComponent(config.password)}` +
  `@${config.hostname}`;

// One client for the whole app. It keeps a pool of connections open and
// reuses them, so it's created once here instead of once per request.
// serverSelectionTimeoutMS: give up after 5 s if Atlas can't be reached,
// instead of the default 30 s, so startup failures show up quickly.
const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });

let db; // set by connect()
let userCollection; // { userName, passwordHash, token }
let scoreCollection; // { name, score, accuracy, avgTimeMs, date, tones }

// Picks the database (e.g. 'earshot' or 'earshot-dev') and checks that the
// server is reachable and the login works. Rejects if it isn't.
async function connect(dbName) {
  db = client.db(dbName);
  await db.command({ ping: 1 });
  userCollection = db.collection('user');
  scoreCollection = db.collection('score');

  // createIndex does nothing if the index already exists, so it's safe to
  // run on every startup.
  // unique: Mongo itself rejects a second user with the same name, even if
  // two sign-ups arrive at the same moment (see isDuplicateKeyError).
  await userCollection.createIndex({ userName: 1 }, { unique: true });
  // verifyAuth looks a user up by token on every restricted request.
  await userCollection.createIndex({ token: 1 });

  // Score indexes match the sorts used below, field for field:
  // getScoresByName and pruneOldTones: one player's rounds, newest first.
  await scoreCollection.createIndex({ name: 1, date: -1, _id: -1 });
  // getLeaderboard's first $sort: best score first, earlier round on ties.
  await scoreCollection.createIndex({ score: -1, date: 1 });

  await seedScoresIfEmpty();
}

// Fake players so a brand-new database doesn't start with an empty
// leaderboard. (Originally in the frontend's scoreService.js, then in
// index.js's in-memory array.)
const SEED_SCORES = [
  { name: 'frequencyfox', score: 912, accuracy: 0.95, avgTimeMs: 2800, date: '2026-09-18T19:42:00.000Z' },
  { name: 'mixmaster_jo', score: 874, accuracy: 0.92, avgTimeMs: 3400, date: '2026-09-17T15:10:00.000Z' },
  { name: 'ringout_ray', score: 851, accuracy: 0.91, avgTimeMs: 4100, date: '2026-09-15T22:05:00.000Z' },
  { name: 'gainstager', score: 803, accuracy: 0.87, avgTimeMs: 4600, date: '2026-09-14T17:30:00.000Z' },
  { name: 'sub_woofer', score: 768, accuracy: 0.85, avgTimeMs: 5200, date: '2026-09-12T20:48:00.000Z' },
  { name: 'feedback_fiona', score: 730, accuracy: 0.82, avgTimeMs: 5900, date: '2026-09-10T13:15:00.000Z' },
  { name: 'monitor_mo', score: 689, accuracy: 0.79, avgTimeMs: 6300, date: '2026-09-08T18:22:00.000Z' },
];

// Inserts the seed players only into an empty score collection, so they're
// added once per database (on its first startup) and then are just ordinary
// rounds. Restarting never duplicates them.
async function seedScoresIfEmpty() {
  const hasScores = (await scoreCollection.countDocuments({}, { limit: 1 })) > 0;
  if (hasScores) return;

  // Stored as real Dates, like every other round (see addScore).
  await scoreCollection.insertMany(SEED_SCORES.map((seed) => ({ ...seed, date: new Date(seed.date) })));
  console.log(`Seeded ${SEED_SCORES.length} sample players into an empty score collection`);
}

// Closes the connection pool (used when the server shuts down).
function close() {
  return client.close();
}

// True if an insert failed because a unique index already has that value.
// 11000 is MongoDB's "duplicate key" error code.
function isDuplicateKeyError(err) {
  return err?.code === 11000;
}

// True if an error means "can't reach the database right now", as opposed to
// a bug in a query:
// - MongoServerSelectionError: no server answered within serverSelectionTimeoutMS
//   (Atlas down, network down, IP not allowed)
// - MongoNetworkError: a connection dropped or timed out mid-operation
// - MongoNotConnectedError / MongoTopologyClosedError: the client was closed
//   (e.g. a request still running while the server shuts down)
function isDatabaseUnavailable(err) {
  return (
    err instanceof MongoServerSelectionError ||
    err instanceof MongoNetworkError ||
    err instanceof MongoNotConnectedError ||
    err instanceof MongoTopologyClosedError
  );
}

// --- Users ---
// Callers must pass plain strings (index.js checks), so a value like
// { $ne: null } can never be slipped into a query.

// Resolves to the user document, or null if there's no such user.
function getUserByName(userName) {
  return userCollection.findOne({ userName });
}

function getUserByToken(token) {
  return userCollection.findOne({ token });
}

function addUser(user) {
  return userCollection.insertOne(user);
}

// $set changes just the token field and leaves the rest of the document alone.
function setUserToken(userName, token) {
  return userCollection.updateOne({ userName }, { $set: { token } });
}

// $unset removes the token field entirely (logging out).
function clearUserToken(userName) {
  return userCollection.updateOne({ userName }, { $unset: { token: '' } });
}

// --- Scores ---

// Only each player's newest few rounds keep their per-tone results. Older
// rounds keep their score, accuracy, time, and date forever, but lose `tones`
// so the database doesn't keep growing by 10 tones per round.
const TONE_HISTORY_SIZE = 5;

// Saves one finished round, then trims that player's older tone details.
// `date` should be a real Date object (not a string) so Mongo stores it as a
// date and can sort by it.
async function addScore(score) {
  await scoreCollection.insertOne(score);

  // The round is already saved at this point, so a failure here shouldn't
  // turn into an error for the player. Log it; the next save tries again.
  try {
    await pruneOldTones(score.name);
  } catch (err) {
    console.error(`Couldn't prune old tones for ${score.name}:`, err);
  }
}

// Removes `tones` from every round of this player's except the newest
// TONE_HISTORY_SIZE that still have them.
async function pruneOldTones(name) {
  const older = await scoreCollection
    .find(
      { name, tones: { $exists: true } },
      {
        sort: { date: -1, _id: -1 }, // newest first (_id breaks exact-time ties)
        skip: TONE_HISTORY_SIZE, // keep the newest ones
        projection: { _id: 1 }, // only need their ids
      }
    )
    .toArray();

  if (older.length > 0) {
    await scoreCollection.updateMany(
      { _id: { $in: older.map((doc) => doc._id) } },
      { $unset: { tones: '' } }
    );
  }
}

// One player's rounds, newest first. `tones` is included on the rounds that
// still have it (the newest TONE_HISTORY_SIZE), for the Profile breakdown.
function getScoresByName(name) {
  return scoreCollection
    .find({ name }, { sort: { date: -1, _id: -1 }, projection: { _id: 0 } })
    .toArray();
}

const LEADERBOARD_SIZE = 10;

// Each player's best round, highest score first, top LEADERBOARD_SIZE only.
// An aggregation pipeline: each stage's output documents are the next
// stage's input, and it all runs inside MongoDB.
function getLeaderboard() {
  return scoreCollection
    .aggregate([
      // 1. Best rounds first. On a tied score, the earlier round ranks higher.
      { $sort: { score: -1, date: 1 } },
      // 2. One group per player. Because of the sort, each group's first
      //    document is that player's best round; keep the whole thing.
      { $group: { _id: '$name', best: { $first: '$$ROOT' } } },
      // 3. Unwrap { _id, best: {...round} } back into just the round.
      { $replaceWith: '$best' },
      // 4. Grouping doesn't keep any order, so sort the players again.
      { $sort: { score: -1, date: 1 } },
      // 5. Top 10 players.
      { $limit: LEADERBOARD_SIZE },
      // 6. The public leaderboard never sends _id or anyone's tones.
      { $project: { _id: 0, tones: 0 } },
    ])
    .toArray();
}

module.exports = {
  connect,
  close,
  isDuplicateKeyError,
  isDatabaseUnavailable,
  getUserByName,
  getUserByToken,
  addUser,
  setUserToken,
  clearUserToken,
  addScore,
  getScoresByName,
  getLeaderboard,
};
