// Mock of the third-party note/frequency reference API. It computes the answer
// locally, but returns it asynchronously in the same shape the real API's JSON
// response will have, so swapping in fetch() later won't change the caller.

const FAKE_LATENCY_MS = 300;

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTALS = { '': 0, '#': 1, b: -1 };

// "A4" → 69, "C#3" → 49, "Bb2" → 46. Returns null if it isn't a note name.
function parseMidiNumber(note) {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!match) return null;
  const [, letter, accidental = '', octave] = match;
  return (Number(octave) + 1) * 12 + SEMITONES[letter] + ACCIDENTALS[accidental];
}

// Response shape: { note: 'A4', frequency: 440, midi: 69 }
export async function lookupNote(input) {
  await new Promise((resolve) => setTimeout(resolve, FAKE_LATENCY_MS));

  const trimmed = input.trim();
  const note = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const midi = parseMidiNumber(note);
  if (midi === null || midi < 0 || midi > 127) {
    throw new Error(`"${trimmed}" isn't a note we recognize. Try something like A4, C#3, or Bb2.`);
  }

  const frequency = Math.round(440 * Math.pow(2, (midi - 69) / 12) * 100) / 100;
  return { note, frequency, midi };
}
