import React from 'react';
import { NavLink } from 'react-router-dom';

export function Home() {
  return (
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
          your ear to answer that question instantly. Log in or create an account below to start
          training and see how your ears stack up on the global leaderboard.
        </p>
        <p id="auth-actions">
          <NavLink to="/login"><button type="button" className="btn btn-brand">Login</button></NavLink>
          <NavLink to="/createAccount"><button type="button" className="btn btn-brand">Create Account</button></NavLink>
        </p>
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
        <p className="placeholder-tag">[Placeholder: Third-Party API]</p>
        <p>
          This panel will eventually pull note-to-frequency
          data from an external audio reference API so players can cross-check standard pitches
          while training. See
          <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API" target="_blank" rel="noopener">MDN's Web Audio API docs</a>
          for the browser-side tone generation this feature will build on.
        </p>
        <ul>
          <li>A4 &mdash; 440 Hz</li>
          <li>E2 &mdash; 82.41 Hz</li>
          <li>C6 &mdash; 1046.5 Hz</li>
        </ul>
        <form action="#" method="get">
          <label htmlFor="note-lookup" className="form-label">Note (e.g. A4)</label>
          <input type="text" id="note-lookup" name="note-lookup" placeholder="e.g. A4" className="form-control" />
          <button type="button" className="btn btn-brand mt-2">Look Up Frequency</button>
        </form>
      </section>
    </main>
  );
}
