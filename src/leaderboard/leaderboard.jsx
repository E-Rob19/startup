import React from 'react';
import { getLeaderboard } from '../services/scoreService';
import { formatPercent, formatSeconds } from '../format';

export function Leaderboard({ userName }) {
  const [scores, setScores] = React.useState(null); // null while loading

  React.useEffect(() => {
    let ignore = false;
    getLeaderboard().then((leaderboard) => {
      if (!ignore) setScores(leaderboard);
    });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <main>
      <section id="leaderboard">
        <h2>Global Leaderboard</h2>
        <p><small>Each player's best round.</small></p>
        {scores === null ? (
          <p>Loading scores…</p>
        ) : scores.length === 0 ? (
          <p>No scores yet. Be the first!</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, i) => (
                  <tr key={entry.name} className={entry.name === userName ? 'current-player' : ''}>
                    <td>{i + 1}</td>
                    <td>
                      {entry.name}
                      {entry.name === userName && ' (you)'}
                    </td>
                    <td>{entry.score}</td>
                    <td>{formatPercent(entry.accuracy)}</td>
                    <td>{formatSeconds(entry.avgTimeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="live-updates">
        <h2>Live Standings</h2>
        <p className="placeholder-tag">[Placeholder: WebSocket Data]</p>
        <ul id="live-feed">
          <li>frequencyfox just finished a round with a score of 987.</li>
          <li>mixmaster_jo just finished a round with a score of 951.</li>
          <li>ringout_ray just finished a round with a score of 930.</li>
        </ul>
        <p>
          <small>WebSocket placeholder: the entries above simulate the realtime feed that will update
          as soon as a player finishes a round, without needing to refresh the page.</small>
        </p>
      </section>
    </main>
  );
}
