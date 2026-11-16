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

// Picks the database (e.g. 'earshot' or 'earshot-dev') and checks that the
// server is reachable and the login works. Rejects if it isn't.
async function connect(dbName) {
  db = client.db(dbName);
  await db.command({ ping: 1 });
}

module.exports = { connect };
