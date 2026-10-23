import React from 'react';
import { NavLink } from 'react-router-dom';
import { AuthState } from '../login/authState';
import { playTone, randomFrequency, stopTone } from './audio';
import { ACCURACY_WEIGHT, MAX_SCORE, SPEED_WEIGHT, scoreRound } from './scoring';
import { saveScore } from '../services/scoreService';
import { GameEvent, GameNotifier } from '../services/gameNotifier';
import { formatPercent, formatSeconds } from '../format';

const TONES_PER_ROUND = 10;
const CLEAR_TONES = 5;
const TONE_MS = 1500;
const REPLAY_COOLDOWN_MS = 500;
const TIME_LIMIT_MS = 10000;
const TIMER_TICK_MS = 100;
const BETWEEN_TONES_MS = 1500;
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

// 9500 ms → "0:10", 3200 ms → "0:04". Rounds up so it only hits 0:00 at the very end.
function formatTimeLeft(ms) {
  const seconds = Math.ceil(ms / 1000);
  return `0:${String(seconds).padStart(2, '0')}`;
}

// First CLEAR_TONES tones are clear, the rest have noise.
function createTargets() {
  return Array.from({ length: TONES_PER_ROUND }, (_, i) => ({
    freq: randomFrequency(),
    withNoise: i >= CLEAR_TONES,
  }));
}

function FrequencyFader({ value, onChange, disabled }) {
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
        disabled={disabled}
      />
    </div>
  );
}

export function Game({ userName, authState }) {
  const [phase, setPhase] = React.useState('idle'); // 'idle' | 'inRound' | 'betweenTones' | 'finished'
  const [targets, setTargets] = React.useState([]);
  const [toneIndex, setToneIndex] = React.useState(0);
  const [guesses, setGuesses] = React.useState([]);
  const [sliderPos, setSliderPos] = React.useState(DEFAULT_SLIDER_POS);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [timeLeftMs, setTimeLeftMs] = React.useState(TIME_LIMIT_MS);
  const [saveStatus, setSaveStatus] = React.useState(null); // null | 'saving' | 'saved' | 'error'

  const toneStartRef = React.useRef(0);
  const playIdRef = React.useRef(0);

  // Stop any sound if the player leaves the page mid-tone.
  React.useEffect(() => {
    return () => stopTone();
  }, []);

  // Countdown for the current tone. Restarts whenever a new tone starts,
  // and the cleanup stops the old interval so only one ever runs.
  React.useEffect(() => {
    if (phase !== 'inRound') return;

    const deadline = toneStartRef.current + TIME_LIMIT_MS;
    const tick = () => setTimeLeftMs(Math.max(0, deadline - performance.now()));
    tick();
    const intervalId = setInterval(tick, TIMER_TICK_MS);
    return () => clearInterval(intervalId);
  }, [phase, toneIndex]);

  // Out of time: submit whatever the fader is on. This runs after a render,
  // so handleTimeout sees the current fader position, not a stale one.
  React.useEffect(() => {
    if (phase === 'inRound' && timeLeftMs === 0) {
      handleTimeout();
    }
  }, [phase, timeLeftMs]);

  // Short pause after each answer, then the next tone (or the results).
  // Gives the ear a break and stops a late click from answering the next tone.
  React.useEffect(() => {
    if (phase !== 'betweenTones') return;

    const timeoutId = setTimeout(() => {
      const nextIndex = toneIndex + 1;
      if (nextIndex < TONES_PER_ROUND) {
        setToneIndex(nextIndex);
        setPhase('inRound');
        startTone(targets[nextIndex]);
      } else {
        setPhase('finished');
        if (authState === AuthState.Authenticated) {
          saveRound(guesses);
        }
      }
    }, BETWEEN_TONES_MS);
    return () => clearTimeout(timeoutId);
  }, [phase, toneIndex]);

  const guessFreq = sliderToFreq(sliderPos);
  const currentTarget = targets[toneIndex];
  const isBetweenTones = phase === 'betweenTones';
  const lastGuess = guesses[guesses.length - 1];
  const results = phase === 'finished' ? scoreRound(guesses, TIME_LIMIT_MS) : null;

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
    setTimeLeftMs(TIME_LIMIT_MS);
    toneStartRef.current = performance.now();
    play(target);
  }

  // Saves a finished round for the logged-in player.
  async function saveRound(finalGuesses) {
    const { score, accuracy, avgTimeMs } = scoreRound(finalGuesses, TIME_LIMIT_MS);
    const entry = { name: userName, score, accuracy, avgTimeMs, date: new Date().toISOString() };
    setSaveStatus('saving');
    try {
      await saveScore(entry);
      GameNotifier.broadcastEvent(GameEvent.RoundFinished, entry);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  function startRound() {
    const newTargets = createTargets();
    setTargets(newTargets);
    setGuesses([]);
    setSaveStatus(null);
    setToneIndex(0);
    setPhase('inRound');
    startTone(newTargets[0]);
  }

  function recordGuess(timeMs, timedOut) {
    stopTone();
    playIdRef.current++;
    setIsPlaying(false);

    setGuesses([
      ...guesses,
      {
        target: currentTarget.freq,
        withNoise: currentTarget.withNoise,
        guess: guessFreq,
        timeMs,
        timedOut,
      },
    ]);
    setPhase('betweenTones');
  }

  function submitGuess(e) {
    e.preventDefault();
    if (phase !== 'inRound') return;
    const elapsed = Math.round(performance.now() - toneStartRef.current);
    recordGuess(Math.min(elapsed, TIME_LIMIT_MS), false);
  }

  // What happens when time runs out. For now: submit wherever the fader is,
  // counting the full time limit as the response time.
  function handleTimeout() {
    recordGuess(TIME_LIMIT_MS, true);
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

      {(phase === 'inRound' || isBetweenTones) && (
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
            <p
              id="countdown-timer"
              className={!isBetweenTones && timeLeftMs <= 3000 ? 'text-danger' : ''}
              role="status"
            >
              {isBetweenTones ? (
                <>
                  {lastGuess.timedOut ? "Time's up!" : 'Got it!'}{' '}
                  {toneIndex + 1 < TONES_PER_ROUND ? `Get ready for tone ${toneIndex + 2}…` : 'Tallying your round…'}
                </>
              ) : (
                <>Time Left: <span id="time-left">{formatTimeLeft(timeLeftMs)}</span></>
              )}
            </p>
            <button
              type="button"
              className="btn btn-brand"
              onClick={() => play(currentTarget)}
              disabled={isPlaying || isBetweenTones}
            >
              {isPlaying ? 'Playing…' : 'Play Tone'}
            </button>
          </section>

          <section id="guess-form">
            <h2>Submit Your Guess</h2>
            <form onSubmit={submitGuess}>
              <label htmlFor="frequency-guess" className="form-label">Frequency (Hz)</label>
              <FrequencyFader value={sliderPos} onChange={setSliderPos} disabled={isBetweenTones} />
              <p id="frequency-value">Guess: <span id="frequency-readout">{guessFreq}</span> Hz</p>
              <button type="submit" className="btn btn-brand" disabled={isBetweenTones}>Submit Guess</button>
            </form>
          </section>
        </>
      )}

      {results && (
        <section id="round-results">
          <h2>Round Complete!</h2>
          <p id="final-score">
            {results.score} <small>/ {MAX_SCORE}</small>
          </p>
          <p>
            Accuracy: <strong>{formatPercent(results.accuracy)}</strong> · Avg time:{' '}
            <strong>{formatSeconds(results.avgTimeMs)}</strong>
          </p>
          {authState === AuthState.Authenticated ? (
            <p role="status" className={saveStatus === 'error' ? 'text-danger' : ''}>
              {saveStatus === 'saved' && 'Score saved to your profile and the leaderboard.'}
              {saveStatus === 'saving' && 'Saving your score…'}
              {saveStatus === 'error' && "Couldn't save your score. Your browser storage may be full or blocked."}
            </p>
          ) : (
            <p className="alert alert-warning" role="status">
              Guest scores aren't saved. <NavLink to="/login">Log in</NavLink> to save scores like this one.
            </p>
          )}
          <p>
            <small>
              Score = {formatPercent(ACCURACY_WEIGHT)} accuracy + {formatPercent(SPEED_WEIGHT)} speed. Speed
              only counts as much as each guess was accurate, and a guess one octave or more off counts as 0%.
            </small>
          </p>
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Tone</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Your Guess</th>
                  <th>Accuracy</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {results.tones.map((t, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{t.withNoise ? 'Noise' : 'Clear'}</td>
                    <td>{t.target} Hz</td>
                    <td>{t.guess} Hz</td>
                    <td>{formatPercent(t.accuracy)}</td>
                    <td>{t.timedOut ? "Time's up" : formatSeconds(t.timeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p id="results-actions">
            <button type="button" className="btn btn-brand" onClick={startRound}>Play Again</button>{' '}
            <NavLink to="/leaderboard"><button type="button" className="btn btn-outline-secondary">View Leaderboard</button></NavLink>
          </p>
        </section>
      )}
    </main>
  );
}
