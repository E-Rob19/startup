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
  getUserByName,
  getUserByToken,
  addUser,
  setUserToken,
  clearUserToken,
};
