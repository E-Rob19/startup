import React from 'react';
import { toneAccuracy } from './scoring';
import { formatPercent, formatSeconds } from '../format';

// The per-tone breakdown of one round. Used by the Game's results screen and
// by the Profile's expandable history rows, so both show tones the same way.
//
// tones: [{ target, guess, timeMs, withNoise, timedOut }, ...]
// Rounds saved before the noise/time-out markers were stored don't have
// withNoise/timedOut, so those cells fall back to "—" (or the plain time).
export function ToneTable({ tones }) {
  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover tone-table">
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
          {tones.map((t, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td><ToneType withNoise={t.withNoise} /></td>
              <td>{t.target} Hz</td>
              <td>{t.guess} Hz</td>
              <td>{formatPercent(toneAccuracy(t.guess, t.target))}</td>
              <td>
                {t.timedOut ? <span className="tone-badge tone-badge-timeout">Time's up</span> : formatSeconds(t.timeMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Little pill markers: Noise stands out, Clear stays quiet.
function ToneType({ withNoise }) {
  if (withNoise === true) return <span className="tone-badge tone-badge-noise">Noise</span>;
  if (withNoise === false) return <span className="tone-badge tone-badge-clear">Clear</span>;
  return '—'; // not recorded (saved before step 12a)
}
