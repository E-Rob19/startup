# DB Deliverable Plan

Goal: replace the service's in-memory `users` and `scores` arrays with MongoDB (Atlas), so accounts, sessions, and rounds survive a server restart or redeploy.

Rubric items:
- **Stores data in MongoDB**
- **Stores credentials in MongoDB**

## Where things stand now

Everything the server knows lives in two arrays at the top of `service/index.js`:

| Array | Holds | Becomes |
| --- | --- | --- |
| `users` | `{ userName, passwordHash, token }` | `user` collection |
| `scores` | `{ name, score, accuracy, avgTimeMs, date }` (starts with `SEED_SCORES`) | `score` collection, **plus per-tone results for each player's 5 most recent rounds** (the README's DB/Login section promises "round scores and per-tone results") |

The endpoints don't change, so **the frontend doesn't need any changes** apart from the new per-tone breakdown on the Profile (step 11). The rest of the work is in `service/`:

| File | Change |
| --- | --- |
| `service/database.js` | **New.** Owns the MongoDB connection and every query. `index.js` never touches Mongo directly (same split as Simon). |
| `service/dbConfig.json` | **New, never committed.** Atlas hostname, username, and password. |
| `service/index.js` | Arrays removed. Every lookup becomes an `await DB.something()` call. |
| `.gitignore` | Ignores `service/dbConfig.json` and `db-explanations.md` (now the whole `explanations/` folder) |

## How it differs from Simon

Simon is the reference, but a few things are done differently on purpose:

| Simon | EarShot | Why |
| --- | --- | --- |
| Logs the full connection URL (with the password) if the connection fails | Logs only the error message | Don't leak the DB password into pm2 logs |
| Starts listening before it knows the DB works, then exits if the ping fails | Connects and pings **first**, then calls `app.listen` | No window where requests hit a dead DB |
| High scores are the top 10 *rounds* | Top 10 *players* (each player's best), using an aggregation pipeline | Matches what the leaderboard does now |
| No indexes | Unique index on `userName`, plus indexes for the token and score queries | The unique index also stops two simultaneous sign-ups from both getting the same name |
| `date` stored as a string | `date` stored as a real `Date` | Sorts correctly in Mongo. Express still sends it as an ISO string, so the frontend doesn't notice. |

## Data shapes

```js
// user collection
{ _id, userName: 'emma', passwordHash: '$2b$10$...', token: 'uuid' }   // token removed on logout

// score collection
{ _id, name: 'emma', score: 812, accuracy: 0.88, avgTimeMs: 3900,
  date: ISODate('2026-11-16T...'),
  tones: [ { target: 440, guess: 452.1, timeMs: 3100 }, ... ]  // all 10, only on the player's 5 newest rounds
}
```

**Tones are pruned:** after a round is saved, `tones` gets `$unset` from that player's older rounds (everything past the newest `TONE_HISTORY_SIZE = 5`). The score, accuracy, time, and date stay forever, so the full scoring record is kept. Only the bulky per-tone detail is dropped.

`_id`, `passwordHash`, and `token` are **never** sent to the browser. `tones` is only sent by `/api/scores/mine` (your own history), never by the public leaderboard.

---

## Step-by-step

There is one commit per step, about 15 in all, which covers the 12-commit goal. Each step ends with something you can test.

### Step 0: Commit this plan
- [ ] Commit `db-plan.md`.

### Step 1: Keep the secret out of git, then install the driver
- [x] Add `service/dbConfig.json` (and `db-explanations.md`, later replaced by ignoring the whole `explanations/` folder) to `.gitignore` **before** the file exists, and confirm with `git check-ignore -v service/dbConfig.json`.
- [x] Create `service/dbConfig.json` with `{ hostname, userName, password }`. Reuse the Atlas cluster and database user from Simon (copy `../simon-db/service/dbConfig.json`). I'll copy it without printing it. The database itself is new (`earshot` / `earshot-dev`). Mongo creates it the first time something is written to it.
- [x] `npm install mongodb` in `service/`. (Got `mongodb@7.9.0`. Unlike `uuid`, it still works with `require`. It needs **Node 20.19 or newer**, which gets checked on the server in step 13.)
- [x] Test: `git status` doesn't list `dbConfig.json`.
- Note: `deployService.sh` already does `cp service/*.json build`, so the config reaches the server without any script changes.

### Step 2: Connect before listening
- [x] `service/database.js`: build the `mongodb+srv://` URL from the config, create one `MongoClient`, and export a `connect(dbName)` that pings the server. (**Extra:** the username and password are URL-encoded, so special characters can't break the URL, and a 5-second `serverSelectionTimeoutMS` makes an unreachable cluster fail fast instead of after 30 s.)
- [x] **Dev vs prod database:** `node index.js [port] [dbName]`. The database name comes from the command line, like the port, and defaults to `earshot`, so the deployed pm2 service uses the live database with no setup changes. Add an `npm run dev` script in `service/package.json` that runs `node index.js 4000 earshot-dev` for local work.
- [x] `index.js`: `await DB.connect(dbName)` and **then** `app.listen`. If the connection fails, log a clear message (without the URL) and exit.
- [x] Test: `npm run dev` prints "Connected to MongoDB (earshot-dev)". Then break the password in a copy of the config, and the server should exit with a readable error. (Also tested an unreachable hostname. Both exit with code 1 and never start listening.)
- From now on, run the backend locally with `npm run dev` (not `npm start`), so test data stays out of the live database.

### Step 3: Users and credentials in MongoDB
- [x] `database.js`: `getUserByName`, `getUserByToken`, `addUser`, `setUserToken`, `clearUserToken`.
- [x] `index.js`: `findUser` becomes async, and create, login, logout, and `verifyAuth` all `await` it. Delete the `users` array.
- [x] **Extra (security):** `findUser` only looks up plain strings. `cookie-parser` turns a cookie like `token=j:{"$ne":null}` into the object `{ $ne: null }`, which Mongo would read as "any user whose token isn't null". That would log an attacker in as a random logged-in user.
- [x] Test (scripted, against `earshot-dev`, with the test user cleaned up afterward): register → log in → `/api/user/me` → **restart the server** → `/api/user/me` with the same cookie still works (it would have returned 401 before this step). The user doc holds a bcrypt hash, not the password. Also: the forged cookie and `{ $ne: null }` login both return 401, and logout removes the token from the doc. (21/21 checks passed.)

### Step 4: Unique usernames, enforced by the database
- [x] On connect, `createIndex({ userName: 1 }, { unique: true })` and `createIndex({ token: 1 })`.
- [x] If `insertOne` throws a duplicate key error (code `11000`), return 409. The "check first, then insert" code can't stop two sign-ups that arrive at the same moment, but the index can. (The check is kept for the normal case. The 11000 test is `DB.isDuplicateKeyError(err)`, so the Mongo-specific code stays in `database.js`.)
- [x] Test: duplicate sign-up still returns 409. Also fire two identical sign-ups at the same time and confirm only one account exists. (**Before the fix:** 5 simultaneous sign-ups → three 200s and **3 accounts** with the same name. **After:** one 200, four 409s, 1 account.)

### Step 5: Save rounds to MongoDB
- [x] `database.js`: `addScore(entry)`.
- [x] `POST /api/score` saves `{ name, score, accuracy, avgTimeMs, date: new Date(), tones }`, then responds with the same fields as today (no `_id`, no `tones`), so `game.jsx` keeps working.
  - Each tone is rebuilt as `{ target, guess, timeMs }` before saving. `isValidRound` checks those three fields but allows extra ones, so without this, junk sent in the request would be stored too.
  - **Temporary:** the round is also pushed to the in-memory `scores` array, so the Leaderboard and Profile keep showing new rounds until steps 7 and 8 move them to MongoDB. That way the app works at every commit.
- [x] Test (scripted): a valid round is saved with a real `Date` and exactly 10 tones of 3 fields each. `score`/`name` sent in the body are ignored. 401 without login, 400 for a bad round, and nothing saved from either. (18/18 passed.) *You:* play a round in the browser and find it in Atlas.

### Step 6: Only keep tones for the newest 5 rounds
- [x] `database.js`: `pruneOldTones(name)`. Find that player's rounds that still have `tones`, newest first, skip the first `TONE_HISTORY_SIZE` (5), and `updateMany` with `$unset: { tones: '' }` on the rest. `addScore` calls it right after inserting.
  - If pruning fails, it's logged and **not** sent to the player as an error, because their round is already saved. The next save tries again.
  - The sort is `{ date: -1, _id: -1 }`, so two rounds saved in the same millisecond still have a fixed order.
- [x] Test (scripted): 7 rounds for one player → the newest 5 (rounds 3–7) keep `tones`, rounds 1–2 lost them, and all 7 still have their score. A second player's rounds weren't touched. (5/5 passed, and the step 5 tests still pass.)

### Step 7: Round history from MongoDB
- [x] `database.js`: `getScoresByName(name)`: `find({ name })`, sorted by `date` descending, with a projection that leaves out `_id`. `tones` is included where it still exists, for the Profile breakdown. (Sorted by `{ date: -1, _id: -1 }`, the same tie-breaker as step 6.)
- [x] `GET /api/scores/mine` uses it. (No frontend change: the Profile reads only `score` and `date`, and ignores the extra `tones`.)
- [x] Test (scripted): 7 rounds, then **restart** → all 7 come back newest first, as ISO date strings, with no `_id`, `tones` on the newest 5 only, and no other player's rounds. 401 without login, `[]` for a new player. (11/11 passed.) *You:* check the Profile page in the browser.

### Step 8: Leaderboard with an aggregation pipeline
- [x] `database.js`: `getLeaderboard()` as a pipeline: sort by score → `$group` by name, keeping each player's best round → sort again → `$limit` 10 → `$project` out `_id` and `tones`. (`$replaceWith` unwraps each group back into a plain round. Ties go to the earlier round, the same as the old code.)
- [x] `GET /api/scores` uses it. Delete the JS `getLeaderboard()` helper and the `scores` array. (The temporary array push in `POST /api/score` is gone too, and `LEADERBOARD_SIZE` moved to `database.js`.)
- [x] Test (scripted, in a throwaway `earshot-test` database that gets dropped afterward): 12 random players + ties + a best round with tones → 10 rows, one per player, no `_id`/`tones`, ties resolved by date, and **exactly the same result as the old JS algorithm** (5 runs with random data). Steps 5–7 tests still pass.
- **Known gap until step 9:** `SEED_SCORES` is still in `index.js` but unused, so the leaderboard only shows real players for this one commit.

### Step 9: Seed players live in the database
- [ ] Move `SEED_SCORES` into `database.js`. On connect, if the `score` collection is empty, `insertMany` them (with their dates converted to `Date`). After that they're ordinary data.
- [ ] Test: drop the collection in Atlas, restart, and the seven players come back. Restart again and they **aren't** duplicated.

### Step 10: Indexes for the score queries
- [ ] On connect: `{ name: 1, date: -1 }` (history) and `{ score: -1 }` (leaderboard).
- [ ] Test: run `explain()` from a small scratch script (not committed) and see `IXSCAN` instead of `COLLSCAN`. (With this little data it's about learning, not speed.)

### Step 11: When the database goes away
- [ ] Close the client on `SIGINT` / `SIGTERM` so `pm2 restart` and Ctrl+C shut down cleanly.
- [ ] A DB error during a request already reaches the Express 5 error handler (500). Make sure the log says it was a database error, and that the browser sees the usual friendly message, not Mongo's error text.
- [ ] Test: start the server, cut the network (or block Atlas), and hit `/api/scores` → JSON 500 with a friendly message, and the Leaderboard shows its error state.

### Step 12: Per-tone breakdown on the Profile
- [ ] In the Profile's history table, each round that still has `tones` gets an arrow toggle button (▸ / ▾) that shows or hides a row underneath with its 10 tones: target, your guess, how far off, and time. Older rounds have no toggle, just their score.
- [ ] Track which rounds are open in state, so several can be open at once. Use `aria-expanded` on the button for screen readers.
- [ ] A short note under the table: "Tone breakdowns are kept for your 5 most recent rounds."
- [ ] Reuse the Game results screen's formatting (Hz/kHz, "how far off") where it fits, instead of writing it twice.
- [ ] Test: the newest 5 rounds expand and collapse. Older ones don't have the toggle. Works on a phone-width window.
- *Might take 2 commits:* the toggle and expanding row first, then the styling.

### Step 13: Deploy
- [ ] In Atlas **Network Access**, check that the EC2 server's IP is allowed (Simon's setup may already allow it).
- [ ] Check `node -v` on the server is 20.19 or newer (the `mongodb` 7 driver requires it).
- [ ] Deploy (you, by hand): `./deployService.sh -k <key> -h earshot.click -s startup`.
- [ ] Test on the live site: create an account, play a round, then redeploy (or `pm2 restart startup`) and confirm the account, the round, and the leaderboard entry are all still there. That's the real proof for this deliverable.

### Step 14: Write-up
- [ ] Final explanations update (wrap-up section with the rubric mapping and a summary of plan changes).
- [ ] README DB section (only when you tell me to).

---

## Decisions (confirmed)

1. **Atlas cluster:** reuse Simon's cluster and DB user, with a new database. No new Atlas setup.
2. **Dev vs prod data:** the live site uses `earshot`, and local runs use `earshot-dev` (chosen by a command-line argument, see step 2), so test accounts never show up on the live leaderboard.
3. **Per-tone results:** stored for each player's **5 most recent rounds** only, so the database doesn't grow without limit (step 6). The score record for every round is kept. The Profile shows them behind a show/hide arrow per round (step 12).
4. **Usernames stay case-sensitive** (`Emma` and `emma` are different accounts), the same as now.
5. **Explanations** go in `explanations/db-explanations.md`. The whole `explanations/` folder (all stages) is gitignored.
