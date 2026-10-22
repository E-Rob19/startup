# React Part 2: Reactivity Plan

Goal: make EarShot fully functional in the browser. Anything that will later need the backend, database, WebSocket, or a third-party API gets mocked in JavaScript for now. Rubric items: **all functionality implemented or mocked out**, and **hooks** (`useState`, `useEffect`, and probably `useRef`).

## Where things stand now

Every page is static JSX carried over from the HTML/CSS deliverables:

| Page | Current state | Needs |
| --- | --- | --- |
| `app.jsx` | Static navbar, routes | Track who is logged in, add a logout button, hide or guard pages that need login |
| `login.jsx` / `createAccount.jsx` | Forms with `action="#"`, they don't do anything | Controlled inputs, mock auth with localStorage, redirect after success |
| `game.jsx` | Static "Tone 1 of 10", the slider updates the page through `document.getElementById` | The whole round: play tones, take guesses, run the timer, score the round, save it |
| `leaderboard.jsx` | Hard-coded table and live feed | Read scores from storage, sort them, add a simulated live feed |
| `profile.jsx` | Hard-coded history, shows "Guest" | Show the logged-in user's real round history |
| `home.jsx` | Static frequency reference, Login/Create Account buttons always shown | Mocked note lookup, buttons that change when you're logged in |

## What gets mocked and how

| Real thing (later) | Mock for now |
| --- | --- |
| Login / register endpoints + MongoDB users | `localStorage`: a `users` object `{ username: password }`, plus `userName` for the current session |
| Scores collection in MongoDB | `localStorage` `scores` array: `{ name, score, accuracy, avgTime, date }` |
| Leaderboard + history endpoints | Read and sort or filter the `scores` array |
| WebSocket "player finished a round" broadcast | `setInterval` that produces fake players' results every few seconds |
| Third-party note/frequency API | An async `lookupNote()` that returns a hard-coded response shaped like the real API will be |
| Tone/noise generation | **Built for real:** the Web Audio API runs in the browser, so this doesn't need mocking |

Keep the mocks in their own small modules (for example `src/services/`) so the Service, DB, and WebSocket deliverables only have to change those files and not the components.

---

## Step-by-step

Commit after each step. Small commits also satisfy the "Git commits" prerequisite.

### Step 1: Auth state in `App`
- [x] Add an `AuthState` enum (`Unknown`, `Authenticated`, `Unauthenticated`), the same pattern Simon uses.
- [x] In `App`, `useState` for `userName`, initialized from `localStorage.getItem('userName')`, and derive `authState` from it.
- [x] Pass `userName` and an `onAuthChange(userName, authState)` callback down to `Login`, `CreateAccount`, `Home`, `Game`, and `Profile`.
- [x] Navbar: always show **Play** (guests can play). Show **Profile** only when authenticated. Show **Logout** when logged in and **Login** when not.
- [x] Logout: remove `userName` from localStorage, reset the state, and navigate home.

### Step 2: Login and Create Account
- [x] Turn the inputs into controlled components (`useState` for each field).
- [x] Create an `authService.js` mock with `register(user, pw)`, `login(user, pw)`, and `logout()`, backed by localStorage. Have each one return a Promise so it already looks like `fetch` and is easy to swap out later.
- [x] Create Account: check that the passwords match and the username isn't already taken, then call `register` and log the user in.
- [x] Login: check the credentials against the stored `users`.
- [x] Show error messages in the page through state, not `alert()`. Disable the submit button while fields are empty.
- [x] Use `useNavigate()` to go to `/game` after success.
- [x] Remove the `[Placeholder: Authentication]` tags.

### Step 3: Guard the protected pages
- [ ] If `Profile` is visited while logged out, redirect to `/login`.
- [ ] `Game` stays open to guests. Show a banner when logged out: "Playing as guest. Your scores won't be saved. *Log in* to get on the leaderboard."
- [ ] Home: replace the Login/Create Account buttons with "Welcome back, *name*" and a **Start Playing** button when logged in.

### Step 4: Audio engine (real, not mocked)
- [ ] `src/game/audio.js`: create one shared `AudioContext` (it must be created or resumed after a user click, because browsers block autoplay).
- [ ] `playTone(freq, durationMs, { withNoise })`: an `OscillatorNode` (sine) through a `GainNode` with short fade-in and fade-out ramps so the tones don't click.
- [ ] Noise: generate a white- or pink-noise `AudioBuffer` once and loop it at a lower gain under the tone for the "mixed with noise" tones.
- [ ] Pick target frequencies on a smooth (continuous) log scale between about 63 Hz and 8 kHz, the range that matters for ringing out: `freq = 63 × (8000 / 63)^Math.random()`, rounded to the nearest Hz.
- [ ] `playTone` returns a Promise that resolves when the tone finishes, so the game knows when it's safe to play again.

### Step 5: Game round state machine
Use `useState` for the round phase: `idle → playing → guessing → … → finished`.
- [ ] State: `targets` (10 frequencies plus a noise flag for each, generated when the round starts), `toneIndex`, `guesses` (array of `{ guess, target, timeMs }`), `phase`.
- [ ] Each round has exactly 5 clear tones and 5 noisy tones. Plan: tones 1–5 clear, 6–10 noisy, so difficulty ramps up. (Shuffling the order instead is a one-line change if you'd rather.) Show a "Clear" / "With noise" label for the current tone.
- [ ] Make the slider controlled: `sliderPos` state, with the Hz value derived using the existing log formula. Delete the `document.getElementById` code.
- [ ] **Start Round** button → generate targets, set `toneIndex = 0`, play the first tone.
- [ ] **Play Tone** replays the current tone as many times as the player wants.
  - To stop replays from overlapping or cutting each other off, keep an `isPlaying` state. Set it when a tone starts, and clear it about 500 ms after the `playTone` Promise resolves (a short cooldown).
  - Disable the Play Tone button while `isPlaying` is true, and change its label to "Playing…".
  - Submitting a guess also stops any tone that's still playing before the next one starts.
- [ ] **Submit Guess** → record the guess and response time, move to the next tone, and finish after 10.
- [ ] The progress bar and "Tone X of 10" read from `toneIndex`.
- [ ] Show "Welcome back, *userName*" instead of "Guest".

### Step 6: Timer
- [ ] `useRef` to store the timestamp when each tone first played, which gives the response time.
- [ ] `useEffect` + `setInterval` for the countdown display (10 s per tone). Clear the interval in the effect's cleanup function.
- [ ] When time runs out, auto-submit wherever the slider currently is, using the full 10 s as the response time. (Might change later, so keep this in one `handleTimeout` function.)

### Step 7: Scoring
- [ ] Per-tone accuracy from the error in octaves: `err = |log2(guess / target)|`. Measuring in octaves is fair across the whole spectrum, so being off by 100 Hz at 8 kHz counts as close but at 100 Hz counts as way off.
  - Example: `accuracy = max(0, 1 - err / 1)`, which gives 100% for exact, 67% at 1/3 octave off, and 0% at a full octave or more.
- [ ] Per-tone speed score: `max(0, 1 - timeMs / 10000)`.
- [ ] Round score = `1000 × (0.7 × avgAccuracy + 0.3 × avgSpeed)`. Accuracy is weighted higher, as the README promises.
- [ ] Results screen: total score, accuracy %, average time, and a per-tone breakdown table (target vs. guess). Then **Play Again** and **View Leaderboard** buttons.

### Step 8: Save scores
- [ ] `scoreService.js` with `saveScore(entry)`, `getLeaderboard()` (sort by score descending, top 10), and `getHistory(userName)` (filter by name, newest first).
- [ ] Call `saveScore` when the round finishes, **only if the player is logged in**. Guests still see their full results screen, with a note: "Log in to save scores like this one."
- [ ] Seed a few fake players the first time it runs, so the leaderboard isn't empty on a fresh browser.
- [ ] Fire a local "score posted" event (used in step 10) so your own finish appears in the live feed. Skip this for guests too.

### Step 9: Leaderboard and Profile read real data
- [ ] Leaderboard: `useEffect` on mount → `getLeaderboard()` → `useState` → render the rows with `.map()`. Highlight the current user's rows.
- [ ] Profile: `getHistory(userName)` → table. Show an empty state ("No rounds yet, go play!") and maybe a best score / average summary at the top.
- [ ] Remove the `[Placeholder: Database Data]` tags and the "rows above stand in for…" notes.

### Step 10: Simulated WebSocket live feed
- [ ] `gameNotifier.js` (same idea as Simon's): a class that keeps a list of handlers, plus a `setInterval` that every 5–8 s makes up a "*player* just finished a round with a score of *N*" event and sends it to the handlers.
- [ ] Leaderboard `useEffect` subscribes on mount and unsubscribes in cleanup. New events go to the top of the live feed, which is capped at about 10 entries.
- [ ] Optional: also insert the fake scores into the leaderboard table so it visibly changes live.
- [ ] Remove the `[Placeholder: WebSocket Data]` tag.

### Step 11: Mocked third-party API (Frequency Reference on Home)
- [ ] `noteService.js` → `lookupNote('A4')` returns a Promise that resolves to a hard-coded or computed object shaped like the future API response, for example `{ note: 'A4', frequency: 440.0, midi: 69 }`. (Computing it with `440 × 2^((midi − 69) / 12)` is fine. It's still a stand-in for the endpoint.)
- [ ] Make the note input controlled, have the button call `lookupNote`, display the result, and show an error for input that doesn't parse.
- [ ] Remove the `[Placeholder: Third-Party API]` tag.

### Step 12: Cleanup and deploy
- [ ] Search for leftover `placeholder-tag`s, `action="#"`, and `document.getElementById` calls.
- [ ] Test the whole flow in a private window (empty localStorage): create account → play a round → score shows up on the leaderboard and profile → logout → protected pages redirect.
- [ ] Run `npm run build` and fix any warnings, then deploy with `./deployReact.sh`.
- [ ] Update the README's React Part 2 section (you'll write this one yourself).

---

## Decisions

1. **Target frequencies:** smooth, continuous log scale (not snapped to bands).
2. **Replays:** unlimited, but the Play button is disabled while a tone plays plus a short cooldown, so tones never overlap.
3. **Timeout:** auto-submit wherever the slider is. (May revisit later.)
4. **Noise:** 5 clear tones and 5 noisy tones per round (clear first, then noisy).
5. **Guests:** can play a full round, but their scores aren't saved to the leaderboard or history.
