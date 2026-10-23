import React from 'react';
import { NavLink } from 'react-router-dom';
import { AuthState } from '../login/authState';
import { lookupNote } from '../services/noteService';
import { playTone, stopTone } from '../game/audio';

export function Home({ userName, authState }) {
  const [noteInput, setNoteInput] = React.useState('');
  const [lookupResult, setLookupResult] = React.useState(null);
  const [lookupError, setLookupError] = React.useState('');
  const [isLooking, setIsLooking] = React.useState(false);

  // Stop the Play button's tone if the player leaves the page.
  React.useEffect(() => {
    return () => stopTone();
  }, []);

  async function handleLookup(e) {
    e.preventDefault();
    setIsLooking(true);
    setLookupError('');
    setLookupResult(null);
    try {
      setLookupResult(await lookupNote(noteInput));
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setIsLooking(false);
    }
  }

  return (
    <>
      {/* TEMPORARY: remove this repo link once it's no longer needed for grading */}
      <p id="repo-link" style={{ fontSize: '1.3em' }}>
        <strong>
          <a href="https://github.com/E-Rob19/startup" target="_blank" rel="noopener">
            View this project on GitHub
          </a>
        </strong>
      </p>
      {/* TEMPORARY: remove this line once it's no longer needed for grading */}
      <p id="author-name">CS260 Startup: Emma Robinson</p>

      <main>
        <section id="hero">
          <h1 id="site-title">EarShot</h1>
          <svg id="tone-graphic" width="200" height="80" viewBox="0 0 200 80" role="img" aria-label="Waveform of the current tone">
            <polyline points="0,40 20,10 40,70 60,10 80,70 100,10 120,70 140,10 160,70 180,40 200,40" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
        </section>

        <section id="welcome">
          <h2>Welcome to EarShot</h2>
          <p>
            Every live sound engineer knows the moment: you're ringing out a room before doors open,
            and a frequency is feeding back somewhere in the mix, but which one is it? EarShot trains
            your ear to answer that question instantly.
          </p>
          {authState === AuthState.Authenticated ? (
            <>
              <p>Welcome back, <strong>{userName}</strong>! Ready for another round?</p>
              <p id="auth-actions" className="d-flex flex-wrap gap-2">
                <NavLink to="/game" className="btn btn-brand">Start Playing</NavLink>
              </p>
            </>
          ) : (
            <>
              <p>
                Log in or create an account below to start training and see how your ears stack up
                on the global leaderboard, or jump straight in as a guest.
              </p>
              <p id="auth-actions" className="d-flex flex-wrap gap-2">
                <NavLink to="/login" className="btn btn-brand">Login</NavLink>
                <NavLink to="/createAccount" className="btn btn-brand">Create Account</NavLink>
                <NavLink to="/game" className="btn btn-outline-secondary">Play as Guest</NavLink>
              </p>
            </>
          )}
        </section>

        <section id="how-to-play">
          <h2>How to Play</h2>
          <ol>
            <li>Log in with your account so your scores are saved to your history and the leaderboard.</li>
            <li>Start a round. Each round serves 10 tones, either isolated or mixed with noise.</li>
            <li>Listen to each tone and submit your best guess for its frequency.</li>
            <li>After all 10 tones, your round is scored on accuracy and response time, with accuracy weighted more heavily.</li>
            <li>Your score posts straight to the global leaderboard as soon as the round ends.</li>
          </ol>
        </section>

        <section id="frequency-reference">
          <h2>Frequency Reference</h2>
          <p>
            Look up the frequency of any musical note to cross-check standard pitches while you
            train. Tones are generated right in your browser with the{' '}
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API" target="_blank" rel="noopener">Web Audio API</a>.
          </p>
          <ul>
            <li>A4 &mdash; 440 Hz</li>
            <li>E2 &mdash; 82.41 Hz</li>
            <li>C6 &mdash; 1046.5 Hz</li>
          </ul>
          <form onSubmit={handleLookup}>
            <label htmlFor="note-lookup" className="form-label">Note (e.g. A4, C#3, Bb2)</label>
            <input
              type="text"
              id="note-lookup"
              placeholder="e.g. A4"
              className="form-control"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <button type="submit" className="btn btn-brand mt-2" disabled={!noteInput.trim() || isLooking}>
              {isLooking ? 'Looking up…' : 'Look Up Frequency'}
            </button>
          </form>
          {lookupError && <p className="text-danger mt-2" role="alert">{lookupError}</p>}
          {lookupResult && (
            <p id="lookup-result" className="mt-2" role="status">
              <strong>{lookupResult.note}</strong> = <strong>{lookupResult.frequency} Hz</strong>{' '}
              <small>(MIDI note {lookupResult.midi})</small>{' '}
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => playTone(lookupResult.frequency)}
              >
                Play
              </button>
            </p>
          )}
        </section>
      </main>
    </>
  );
}
