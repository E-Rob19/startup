# Service Deliverable Plan

Goal: give EarShot a real backend. Add a Node.js/Express service that serves the React frontend and provides auth and score endpoints. Then switch the mocked frontend services over to `fetch()`.

Rubric items:
- **Node.js/Express HTTP service**
- **Static middleware for frontend**
- **Calls to third party endpoints**
- **Backend service endpoints**
- **Frontend calls service endpoints**
- **Registration, login, logout, and a restricted endpoint**
- **BCrypt password hashing**

## Where things stand now

The reactivity deliverable put every backend stand-in in `src/services/`, so most of the frontend work happens in those files:

| File | Current mock | Becomes |
| --- | --- | --- |
| `authService.js` | Users and passwords in `localStorage` (plain text) | `fetch` to `/api/auth/*`. The server hashes passwords with bcrypt and sets an auth cookie. |
| `scoreService.js` | `earshot.scores` array in `localStorage`, seeded with fake players | `fetch` to `/api/scores` and related endpoints. The seed players move to the server. |
| `noteService.js` | Computes the note's frequency locally, after a fake delay | A real third-party call (see **Decisions**) |
| `gameNotifier.js` | `setTimeout` fake players, and it calls `saveScore` for them | **Stays mocked** until the WebSocket deliverable, but it stops saving fake rounds (see step 10) |

Data is kept **in memory on the server** for this deliverable (arrays in `index.js`), so restarting the server wipes it. MongoDB replaces the arrays in the DB deliverable.

## Endpoints

| Method | Path | Auth? | Does |
| --- | --- | --- | --- |
| `POST` | `/api/auth/create` | no | Register. Returns 409 if the username is taken. Hashes the password and sets the cookie. |
| `PUT` | `/api/auth/login` | no | Log in. Returns 401 on a bad username or password. Sets the cookie. |
| `DELETE` | `/api/auth/logout` | no | Clears the user's token and the cookie. Returns 204. |
| `GET` | `/api/user/me` | **yes** | Returns `{ userName }`. The app uses it on startup to check that the session is still valid. |
| `GET` | `/api/scores` | no | Leaderboard: each player's best score, top 10. Guests can see the leaderboard. |
| `GET` | `/api/scores/mine` | **yes** | The logged-in user's round history, newest first |
| `POST` | `/api/score` | **yes** | Saves a round. The name comes from the auth cookie, **not** the request body, so nobody can post scores as someone else. |

The restricted endpoints all sit behind one `verifyAuth` middleware.

---

## Step-by-step

There is one commit per step (or more), about 15 in all, which covers the "at least a dozen commits" goal. Each step ends with something you can test.

### Step 0: Commit this plan
- [x] Commit `service-plan.md`.

### Step 1: Scaffold the Express service
- [x] Create a `service/` folder with its own `package.json` (`npm init -y`, then `npm install express`). (Installed Express 5. Added an `npm start` script.)
- [x] `service/index.js`: create the Express app, read the port from `process.argv[2]` with a default of `4000`, add `express.json()`, mount an `apiRouter` at `/api`, and add a placeholder `GET /api/health` that returns `{ ok: true }`.
- [x] ~~Add `service/node_modules` to `.gitignore`.~~ Already covered: the root `node_modules/` rule matches at any depth.
- [x] Test: `node index.js`, then open `http://localhost:4000/api/health`.

### Step 2: Vite dev proxy
- [x] Add a ~~`vite.config.js`~~ **`vite.config.mjs`** that proxies `/api` to `http://localhost:4000`. This lets the React dev server on 5173 call the backend without CORS problems. (Used `.mjs` because the root `package.json` is `"type": "commonjs"`, and Vite warned about ESM syntax in a `.js` config.)
- [x] Test: run both servers (`node index.js` in `service/` and `npm run dev` at the root), then fetch `/api/health` from the browser console on 5173.

### Step 3: Static middleware for the frontend
- [x] `app.use(express.static('public'))` so the service serves the built React bundle. (Uses `path.join(__dirname, 'public')`, so it works from any working directory.)
- [x] Add a catch-all fallback that sends `public/index.html` for any unknown non-API route. Without it, refreshing on `/leaderboard` in production returns a 404 instead of letting React Router handle the route. (Express 5 dropped `app.get('*')`, so this is a final `app.use(...)`. For now it also answers unknown `/api` paths with HTML. Step 13 fixes that.)
- [x] Add `service/public` to `.gitignore`. The deploy script fills it in.
- [x] Test: `npm run build`, copy `dist/*` into `service/public`, and open `http://localhost:4000/leaderboard` directly.

### Step 4: Registration with bcrypt
- [x] `npm install bcryptjs ~~uuid~~ cookie-parser` (in `service/`), and add `app.use(cookieParser())`. (**Changed:** skipped `uuid`, because its current version is ESM-only and can't be loaded with `require`. Node's built-in `crypto.randomUUID()` does the same thing.)
- [x] Add an in-memory `users` array of `{ userName, passwordHash, token }`.
- [x] `POST /api/auth/create`: return 400 if a field is missing (or isn't a string) and 409 if the name is taken. Otherwise `bcrypt.hash(password, 10)`, create a random UUID token, and set the cookie (`httpOnly`, `secure`, `sameSite: 'strict'`). Return `{ userName }`.
- [x] Test with `curl`: new user → 200 + `Set-Cookie`, duplicate → 409, missing, absent, or wrong-type fields → 400.

### Step 5: Login and logout
- [x] `PUT /api/auth/login`: look up the user and check `bcrypt.compare`. On success, issue a new token and set the cookie. On failure, return 401 with `{ msg: 'Incorrect username or password.' }`. Return the same message for both cases so the response doesn't reveal which usernames exist.
- [x] `DELETE /api/auth/logout`: find the user by cookie token, delete their token, call `res.clearCookie`, and return 204. (Always 204, even with no cookie, so the frontend can always call it.)
- [x] Test with `curl`: wrong password, unknown user, and no body → 401 with the same message. Correct login → 200 + new cookie. Logout → 204 + cookie cleared. Step 6's `/api/user/me` will confirm that the token is really gone.

### Step 6: Restricted endpoint middleware
- [ ] `verifyAuth` middleware: find the user whose token matches `req.cookies.token`. If there is one, attach it as `req.user`. If not, return 401.
- [ ] `GET /api/user/me` (restricted) returns `{ userName }`.
- [ ] Test: call it logged in (200), then after logout (401).

### Step 7: Score endpoints
- [ ] Move `SEED_SCORES` to the server so a fresh server already has a populated leaderboard.
- [ ] `GET /api/scores` (public): best score per player, top 10. This is the same logic as `getLeaderboard()` now.
- [ ] `GET /api/scores/mine` (restricted): `req.user`'s rounds, newest first.
- [ ] `POST /api/score` (restricted): basic validation (score between 0 and 1000, numbers that are numbers). The name comes from `req.user.userName`. Return the saved entry.
- [ ] *2nd commit:* also accept the per-tone `{ target, guess, timeMs }` list and **recompute the score on the server**, matching the README's sequence diagram (server computes the score). This stops anyone from posting a 1000 from the console.

### Step 8: Frontend auth uses the service
- [ ] Rewrite `authService.js` so `register`, `login`, and `logout` call `fetch` (`credentials` are sent automatically on the same origin). On a non-OK response, throw `new Error(body.msg)` so the existing error messages in Login and Create Account keep working unchanged.
- [ ] Keep `earshot.userName` in localStorage only as a UI hint so the navbar renders immediately. The cookie is the real proof of login.
- [ ] Remove the old `earshot.users` localStorage code.

### Step 9: Frontend scores use the service
- [ ] `scoreService.js`: `getLeaderboard` → `GET /api/scores`, `getHistory` → `GET /api/scores/mine`, `saveScore` → `POST /api/score`.
- [ ] Handle 401 (expired or missing session, for example after a server restart): log the user out in the UI and send them to Login, instead of failing silently.
- [ ] Remove the `earshot.scores` localStorage code.

### Step 10: Untangle the fake live feed from saving
- [ ] `gameNotifier.js` currently calls `saveScore` for fake players. Those calls would now fail with 401 (or post fake scores under *your* name). Make fake rounds **feed-only**: they still appear in Live Standings and bump the table locally, but they aren't saved.
- [ ] The player's own finished rounds still go through the notifier as before. The WebSocket deliverable turns this into a real broadcast.

### Step 11: Validate the session on startup
- [ ] In `App`, `useEffect` on mount → `GET /api/user/me`. On 401, clear the stored name and set `Unauthenticated`. This fixes the case where localStorage says "logged in" but the server was restarted and no longer knows the cookie.

### Step 12: Real third-party API call
- [ ] Replace the mock in `noteService.js` (or add alongside it) with a real `fetch` to the API chosen under **Decisions**, keeping the response shape the Home page expects.
- [ ] Show a friendly error if the third-party service is down. Don't break the rest of Home.
- [ ] Remove the fake-latency code.

### Step 13: Error handling and polish
- [ ] Express error-handling middleware that returns `{ msg }` with a 500, plus a JSON 404 for unknown `/api/*` routes, so the HTML fallback from step 3 doesn't answer API typos.
- [ ] Frontend: a "Can't reach the server" message on the Leaderboard and Profile when `fetch` itself fails.
- [ ] Remove `/api/health` (or keep it, it's harmless).

### Step 14: Deploy script
- [ ] Get `deployService.sh` from the Simon service repo (like you did for `deployReact.sh`). It builds the frontend into `service/public`, copies `service/` to the server, runs `npm install` there, and restarts the service with `pm2`.
- [ ] Check that the Caddyfile on the server proxies `startup.earshot.click` → `localhost:4000` (the course default already does).
- [ ] Deploy (you, by hand) with `./deployService.sh -k <key> -h earshot.click -s startup`.
- [ ] Test on the live site in a private window: create account → play → leaderboard → profile → logout → profile redirects. Also refresh on `/leaderboard`.

### Step 15: Write-up
- [ ] Final explanations file update.
- [ ] README Service section (only when you tell me to).

---

## Decisions (confirmed)

1. **Third-party API: Wikipedia REST API.** `GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}` is free, needs no key, and allows CORS. It adds pitch or audio-term blurbs on Home. The note → frequency math stays local, since it's just math. (Exact UI to be settled in step 12.)
2. **Server-side scoring: yes.** Step 7's optional part is now required. The client sends per-tone results and the server computes the score, matching the README's sequence diagram.
3. **Port: `4000`** for the startup service (Simon uses 3000).
4. **Fake live-feed players: feed-only** (not saved) until the WebSocket deliverable.
5. **Explanations** go in a new `service-explanations.md`.
