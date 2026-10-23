import React from 'react';
import { NavLink } from 'react-router-dom';
import { AuthState } from '../login/authState';
import { playTone, randomFrequency } from './audio';

// TEMPORARY: step 4 test helper, removed in step 5.
function testTone(withNoise) {
  const freq = randomFrequency();
  console.log(`Playing ${freq} Hz${withNoise ? ' with noise' : ''}`);
  playTone(freq, 1500, { withNoise }).then(() => console.log('Tone finished'));
}

export function Game({ userName, authState }) {
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

      <section id="tone-visualizer">
        <h2>Now Playing</h2>
        <p className="placeholder-tag">[Placeholder: Application Data]</p>
        <p id="ear-tip">Ear training tip: the human ear can typically detect frequencies from 20 Hz to 20,000 Hz.</p>
      </section>

      <section id="round-status">
        <h2>Round in Progress</h2>
        <p>Tone <span id="tone-number">1</span> of 10</p>
        <div className="progress">
          <div
            className="progress-bar"
            role="progressbar"
            style={{ width: '10%', backgroundColor: '#f7446a' }}
            aria-valuenow="10"
            aria-valuemin="0"
            aria-valuemax="100"
          ></div>
        </div>
        <p id="countdown-timer">Time Left: <span id="time-left">0:10</span></p>
        {/* TEMPORARY test buttons for step 4. Step 5 replaces these with the real round. */}
        <button type="button" className="btn btn-brand" onClick={() => testTone(false)}>Play Tone</button>{' '}
        <button type="button" className="btn btn-brand" onClick={() => testTone(true)}>Play Tone + Noise</button>
      </section>

      <section id="guess-form">
        <h2>Submit Your Guess</h2>
        <form action="#" method="post">
          <label htmlFor="frequency-guess" className="form-label">Frequency (Hz)</label>
          <div id="fader">
            <div className="tick-row" aria-hidden="true">
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 0.0000)' }}><span className="tick-label">20 Hz</span><span className="tick-mark"></span></span>
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 0.1326)' }}><span className="tick-label">50</span><span className="tick-mark"></span></span>
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 0.2330)' }}><span className="tick-label">100</span><span className="tick-mark"></span></span>
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 0.4660)' }}><span className="tick-label">500</span><span className="tick-mark"></span></span>
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 0.5663)' }}><span className="tick-label">1k</span><span className="tick-mark"></span></span>
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 0.7993)' }}><span className="tick-label">5k</span><span className="tick-mark"></span></span>
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 0.8997)' }}><span className="tick-label">10k</span><span className="tick-mark"></span></span>
              <span className="tick major" style={{ left: 'calc(13px + (100% - 26px) * 1.0000)' }}><span className="tick-label">20k</span><span className="tick-mark"></span></span>
            </div>
            <input
              type="range"
              id="frequency-guess"
              min="0"
              max="1000"
              step="1"
              defaultValue="447"
              onInput={(e) => {
                const freq = Math.round(20 * Math.pow(1000, e.target.value / 1000));
                document.getElementById('frequency-readout').textContent = freq;
                document.getElementById('frequency-guess-value').value = freq;
              }}
            />
          </div>
          <input type="hidden" id="frequency-guess-value" name="frequency-guess" defaultValue="440" />
          <p id="frequency-value">Guess: <span id="frequency-readout">440</span> Hz</p>
          <button type="submit" className="btn btn-brand">Submit Guess</button>
        </form>
        <p>Round score, accuracy, and response time will be calculated and displayed here once all 10 tones are guessed.</p>
      </section>
    </main>
  );
}
