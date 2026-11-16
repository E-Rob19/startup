// All MongoDB access lives in this file. index.js never talks to Mongo directly;
// it calls the functions exported here.

const { MongoClient } = require('mongodb');
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

// Picks the database (e.g. 'earshot' or 'earshot-dev') and checks that the
// server is reachable and the login works. Rejects if it isn't.
async function connect(dbName) {
  db = client.db(dbName);
  await db.command({ ping: 1 });
  userCollection = db.collection('user');

  // createIndex does nothing if the index already exists, so it's safe to
  // run on every startup.
  // unique: Mongo itself rejects a second user with the same name, even if
  // two sign-ups arrive at the same moment (see isDuplicateKeyError).
  await userCollection.createIndex({ userName: 1 }, { unique: true });
  // verifyAuth looks a user up by token on every restricted request.
  await userCollection.createIndex({ token: 1 });
}

// True if an insert failed because a unique index already has that value.
// 11000 is MongoDB's "duplicate key" error code.
function isDuplicateKeyError(err) {
  return err?.code === 11000;
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

module.exports = {
  connect,
  isDuplicateKeyError,
  getUserByName,
  getUserByToken,
  addUser,
  setUserToken,
  clearUserToken,
};
