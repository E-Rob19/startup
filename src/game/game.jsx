import React from 'react';
import { NavLink } from 'react-router-dom';
import { AuthState } from '../login/authState';
import { playTone, randomFrequency, stopTone } from './audio';

const TONES_PER_ROUND = 10;
const CLEAR_TONES = 5;
const TONE_MS = 1500;
const REPLAY_COOLDOWN_MS = 500;
const DEFAULT_SLIDER_POS = 447; // about 440 Hz

// Fader tick labels and where they sit along the slider (0 = left, 1 = right).
const FADER_TICKS = [
  ['20 Hz', 0],
  ['50', 0.1326],
  ['100', 0.233],
  ['500', 0.466],
  ['1k', 0.5663],
  ['5k', 0.7993],
  ['10k', 0.8997],
  ['20k', 1],
];

// The slider runs 0–1000; this maps it onto 20 Hz–20 kHz on a log scale.
function sliderToFreq(pos) {
  return Math.round(20 * Math.pow(1000, pos / 1000));
}

// First CLEAR_TONES tones are clear, the rest have noise.
function createTargets() {
  return Array.from({ length: TONES_PER_ROUND }, (_, i) => ({
    freq: randomFrequency(),
    withNoise: i >= CLEAR_TONES,
  }));
}

function FrequencyFader({ value, onChange }) {
  return (
    <div id="fader">
      <div className="tick-row" aria-hidden="true">
        {FADER_TICKS.map(([label, pos]) => (
          <span key={label} className="tick major" style={{ left: `calc(13px + (100% - 26px) * ${pos})` }}>
            <span className="tick-label">{label}</span>
            <span className="tick-mark"></span>
          </span>
        ))}
      </div>
      <input
        type="range"
        id="frequency-guess"
        min="0"
        max="1000"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Game({ userName, authState }) {
  const [phase, setPhase] = React.useState('idle'); // 'idle' | 'inRound' | 'finished'
  const [targets, setTargets] = React.useState([]);
  const [toneIndex, setToneIndex] = React.useState(0);
  const [guesses, setGuesses] = React.useState([]);
  const [sliderPos, setSliderPos] = React.useState(DEFAULT_SLIDER_POS);
  const [isPlaying, setIsPlaying] = React.useState(false);

  const toneStartRef = React.useRef(0);
  const playIdRef = React.useRef(0);

  // Stop any sound if the player leaves the page mid-tone.
  React.useEffect(() => {
    return () => stopTone();
  }, []);

  const guessFreq = sliderToFreq(sliderPos);
  const currentTarget = targets[toneIndex];

  // Plays a tone, then keeps the Play button disabled for a short cooldown.
  // playId makes sure an older, cut-off tone can't re-enable the button
  // while a newer tone is still playing.
  async function play(target) {
    const playId = ++playIdRef.current;
    setIsPlaying(true);
    await playTone(target.freq, TONE_MS, { withNoise: target.withNoise });
    await new Promise((resolve) => setTimeout(resolve, REPLAY_COOLDOWN_MS));
    if (playIdRef.current === playId) {
      setIsPlaying(false);
    }
  }

  // Moves on to a new tone: reset the fader, start the clock, play it.
  function startTone(target) {
    setSliderPos(DEFAULT_SLIDER_POS);
    toneStartRef.current = performance.now();
    play(target);
  }

  function startRound() {
    const newTargets = createTargets();
    setTargets(newTargets);
    setGuesses([]);
    setToneIndex(0);
    setPhase('inRound');
    startTone(newTargets[0]);
  }

  function submitGuess(e) {
    e.preventDefault();
    stopTone();

    setGuesses([
      ...guesses,
      {
        target: currentTarget.freq,
        withNoise: currentTarget.withNoise,
        guess: guessFreq,
        timeMs: Math.round(performance.now() - toneStartRef.current),
      },
    ]);

    const nextIndex = toneIndex + 1;
    if (nextIndex < TONES_PER_ROUND) {
      setToneIndex(nextIndex);
      startTone(targets[nextIndex]);
    } else {
      playIdRef.current++;
      setIsPlaying(false);
      setPhase('finished');
    }
  }

  return (
    <main>
      <section id="player-status">
        {authState === AuthState.Authenticated ? (
          <p>Welcome back, <span id="username">{userName}</span>!</p>
        ) : (
          <p className="alert alert-warning" role="status">
            Playing as guest. Your scores won't be saved.{' '}
            <NavLink to="/login">Log in</NavLink> to get on the leaderboard.
          </p>
        )}
      </section>

      {phase === 'idle' && (
        <section id="round-start">
          <h2>Ready?</h2>
          <p>
            Each round has {TONES_PER_ROUND} tones. The first {CLEAR_TONES} are clear, and the rest
            are mixed with pink noise. Listen, move the fader to your best guess, and submit.
          </p>
          <button type="button" className="btn btn-brand" onClick={startRound}>Start Round</button>
        </section>
      )}

      {phase === 'inRound' && (
        <>
          <section id="tone-visualizer">
            <h2>Now Playing</h2>
            <p>
              Tone {toneIndex + 1}: <strong>{currentTarget.withNoise ? 'With noise' : 'Clear'}</strong>
            </p>
            <p id="ear-tip">Ear training tip: the human ear can typically detect frequencies from 20 Hz to 20,000 Hz.</p>
          </section>

          <section id="round-status">
            <h2>Round in Progress</h2>
            <p>Tone <span id="tone-number">{toneIndex + 1}</span> of {TONES_PER_ROUND}</p>
            <div className="progress">
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${(guesses.length / TONES_PER_ROUND) * 100}%`, backgroundColor: '#f7446a' }}
                aria-valuenow={guesses.length}
                aria-valuemin="0"
                aria-valuemax={TONES_PER_ROUND}
              ></div>
            </div>
            <button
              type="button"
              className="btn btn-brand"
              onClick={() => play(currentTarget)}
              disabled={isPlaying}
            >
              {isPlaying ? 'Playing…' : 'Play Tone'}
            </button>
          </section>

          <section id="guess-form">
            <h2>Submit Your Guess</h2>
            <form onSubmit={submitGuess}>
              <label htmlFor="frequency-guess" className="form-label">Frequency (Hz)</label>
              <FrequencyFader value={sliderPos} onChange={setSliderPos} />
              <p id="frequency-value">Guess: <span id="frequency-readout">{guessFreq}</span> Hz</p>
              <button type="submit" className="btn btn-brand">Submit Guess</button>
            </form>
          </section>
        </>
      )}

      {phase === 'finished' && (
        <section id="round-results">
          <h2>Round Complete!</h2>
          {/* Step 7 replaces this table with the full scored results screen. */}
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Tone</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Your Guess</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {guesses.map((g, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{g.withNoise ? 'Noise' : 'Clear'}</td>
                    <td>{g.target} Hz</td>
                    <td>{g.guess} Hz</td>
                    <td>{(g.timeMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-brand" onClick={startRound}>Play Again</button>
        </section>
      )}
    </main>
  );
}
