// Server-side round scoring. The server is the authority on scores: the client
// sends what happened on each tone, and the score is computed here.
//
// Keep the formula in sync with src/game/scoring.js. The frontend copy is only
// used to show results immediately (and for guests, whose rounds aren't saved).

const MAX_SCORE = 1000;
const ACCURACY_WEIGHT = 0.7;
const SPEED_WEIGHT = 0.3;

// Round rules, matching src/game/game.jsx and src/game/audio.js.
const TONES_PER_ROUND = 10;
const TIME_LIMIT_MS = 10000;
const MIN_TARGET_FREQ = 63; // targets are generated in 63 Hz – 8 kHz
const MAX_TARGET_FREQ = 8000;
const MIN_GUESS_FREQ = 20; // the fader covers 20 Hz – 20 kHz
const MAX_GUESS_FREQ = 20000;

// How far off a guess is, in octaves (fair across the whole frequency range).
function octavesOff(guess, target) {
  return Math.abs(Math.log2(guess / target));
}

// 1 for exact, falling to 0 at one octave (or more) off.
function toneAccuracy(guess, target) {
  return Math.max(0, 1 - octavesOff(guess, target));
}

// 1 for instant, falling to 0 at the time limit.
function toneSpeed(timeMs) {
  return Math.max(0, 1 - timeMs / TIME_LIMIT_MS);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isNumberBetween(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

// True if `tones` is exactly one round's worth of believable results:
// [{ target, guess, timeMs }, ...] × TONES_PER_ROUND, every value in range.
function isValidRound(tones) {
  return (
    Array.isArray(tones) &&
    tones.length === TONES_PER_ROUND &&
    tones.every(
      (tone) =>
        tone !== null &&
        typeof tone === 'object' &&
        isNumberBetween(tone.target, MIN_TARGET_FREQ, MAX_TARGET_FREQ) &&
        isNumberBetween(tone.guess, MIN_GUESS_FREQ, MAX_GUESS_FREQ) &&
        isNumberBetween(tone.timeMs, 0, TIME_LIMIT_MS)
    )
  );
}

// Scores a validated round. Speed only counts as much as the guess was
// accurate, so fast wrong answers earn nothing.
function scoreRound(tones) {
  const accuracies = tones.map((t) => toneAccuracy(t.guess, t.target));
  const speedBonuses = tones.map((t, i) => toneSpeed(t.timeMs) * accuracies[i]);

  const accuracy = average(accuracies);
  const speed = average(speedBonuses);
  const avgTimeMs = Math.round(average(tones.map((t) => t.timeMs)));
  const score = Math.round(MAX_SCORE * (ACCURACY_WEIGHT * accuracy + SPEED_WEIGHT * speed));

  return { score, accuracy, avgTimeMs };
}

module.exports = { isValidRound, scoreRound };
