// Round scoring. Accuracy is weighted more heavily than speed.

export const MAX_SCORE = 1000;
export const ACCURACY_WEIGHT = 0.7;
export const SPEED_WEIGHT = 0.3;

// How far off a guess is, in octaves. Octaves (not Hz) keep it fair across
// the range: 100 Hz off at 8 kHz is close, but 100 Hz off at 100 Hz is way off.
export function octavesOff(guess, target) {
  return Math.abs(Math.log2(guess / target));
}

// 1 for exact, falling to 0 at one octave (or more) off.
export function toneAccuracy(guess, target) {
  return Math.max(0, 1 - octavesOff(guess, target));
}

// 1 for instant, falling to 0 at the time limit.
export function toneSpeed(timeMs, timeLimitMs) {
  return Math.max(0, 1 - timeMs / timeLimitMs);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Scores a whole round from its list of guesses ({ guess, target, timeMs, ... }).
// Speed only counts as much as the guess was accurate, so fast wrong answers
// earn nothing and random button mashing can't rack up points.
export function scoreRound(guesses, timeLimitMs) {
  const tones = guesses.map((g) => {
    const accuracy = toneAccuracy(g.guess, g.target);
    const speed = toneSpeed(g.timeMs, timeLimitMs);
    return { ...g, accuracy, speed, speedBonus: speed * accuracy };
  });

  const accuracy = average(tones.map((t) => t.accuracy));
  const speed = average(tones.map((t) => t.speedBonus));
  const avgTimeMs = average(tones.map((t) => t.timeMs));
  const score = Math.round(MAX_SCORE * (ACCURACY_WEIGHT * accuracy + SPEED_WEIGHT * speed));

  return { score, accuracy, speed, avgTimeMs, tones };
}
