const express = require('express');

const app = express();
const port = process.argv.length > 2 ? process.argv[2] : 4000;

app.use(express.json());

// Allow the Vite dev server (running on a different port) to call this API while testing.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Mock leaderboard data, standing in for scores that will eventually come from MongoDB.
const leaderboard = [
  { rank: 1, player: 'frequencyfox', score: 987, accuracy: 0.96, avgTime: 1.8 },
  { rank: 2, player: 'mixmaster_jo', score: 951, accuracy: 0.94, avgTime: 2.1 },
  { rank: 3, player: 'ringout_ray', score: 930, accuracy: 0.92, avgTime: 2.4 },
];

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard);
});

// Note-to-frequency lookup using equal temperament tuning (A4 = 440 Hz), for the
// homepage's "Frequency Reference" lookup form.
const noteOffsets = {
  C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4,
  'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2,
};

app.get('/api/frequency/:note', (req, res) => {
  const match = req.params.note.match(/^([A-Ga-g]#?)(-?\d+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Note must look like A4, C#3, etc.' });
  }

  const [, letter, octaveStr] = match;
  const noteName = letter.toUpperCase();
  const octave = parseInt(octaveStr, 10);
  if (!(noteName in noteOffsets)) {
    return res.status(400).json({ error: `Unknown note letter: ${letter}` });
  }

  const semitoneOffset = noteOffsets[noteName] + (octave - 4) * 12;
  const frequency = 440 * Math.pow(2, semitoneOffset / 12);
  res.json({ note: `${noteName}${octave}`, frequencyHz: Math.round(frequency * 100) / 100 });
});

// Scores a submitted guess: accuracy is weighted more heavily than response time,
// matching the elevator pitch in the README.
app.post('/api/guess', (req, res) => {
  const { actualFrequency, guessedFrequency, responseTimeSeconds } = req.body;
  if (
    typeof actualFrequency !== 'number' ||
    typeof guessedFrequency !== 'number' ||
    typeof responseTimeSeconds !== 'number'
  ) {
    return res.status(400).json({
      error: 'actualFrequency, guessedFrequency, and responseTimeSeconds must all be numbers.',
    });
  }

  const percentError = Math.abs(actualFrequency - guessedFrequency) / actualFrequency;
  const accuracyScore = Math.max(0, 1 - percentError);
  const speedScore = Math.max(0, 1 - responseTimeSeconds / 10);
  const weightedScore = accuracyScore * 0.75 + speedScore * 0.25;

  res.json({
    accuracy: Math.round(accuracyScore * 100),
    speed: Math.round(speedScore * 100),
    score: Math.round(weightedScore * 100),
  });
});

app.listen(port, () => {
  console.log(`EarShot testing API listening on http://localhost:${port}`);
});
