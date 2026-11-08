// Note → frequency lookup. This is just math (equal temperament, A4 = 440 Hz),
// so it's computed right here instead of calling an API. The third-party API
// on the Home page is Wikipedia (see wikipediaService.js).

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTALS = { '': 0, '#': 1, b: -1 };

// "A4" → 69, "C#3" → 49, "Bb2" → 46. Returns null if it isn't a note name.
function parseMidiNumber(note) {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!match) return null;
  const [, letter, accidental = '', octave] = match;
  return (Number(octave) + 1) * 12 + SEMITONES[letter] + ACCIDENTALS[accidental];
}

// Returns { note: 'A4', frequency: 440, midi: 69 }, or throws for input that
// isn't a note name.
export function lookupNote(input) {
  const trimmed = input.trim();
  const note = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const midi = parseMidiNumber(note);
  if (midi === null || midi < 0 || midi > 127) {
    throw new Error(`"${trimmed}" isn't a note we recognize. Try something like A4, C#3, or Bb2.`);
  }

  const frequency = Math.round(440 * Math.pow(2, (midi - 69) / 12) * 100) / 100;
  return { note, frequency, midi };
}
