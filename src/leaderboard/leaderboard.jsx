import React from 'react';
import { getLeaderboard } from '../services/scoreService';
import { GameNotifier } from '../services/gameNotifier';
import { formatPercent, formatSeconds, formatTime } from '../format';

export function Leaderboard({ userName }) {
  const [scores, setScores] = React.useState(null); // null while loading
  const [feed, setFeed] = React.useState(() => GameNotifier.getRecentEvents());

  // Load the leaderboard, then listen for live events. Each event updates the
  // feed and reloads the table, since the new round may change the standings.
  React.useEffect(() => {
    let ignore = false;

    function loadLeaderboard() {
      getLeaderboard().then((leaderboard) => {
        if (!ignore) setScores(leaderboard);
      });
    }

    function handleGameEvent() {
      setFeed(GameNotifier.getRecentEvents());
      loadLeaderboard();
    }

    loadLeaderboard();
    GameNotifier.addHandler(handleGameEvent);
    return () => {
      ignore = true;
      GameNotifier.removeHandler(handleGameEvent);
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
        {feed.length === 0 ? (
          <p>Waiting for players to finish rounds…</p>
        ) : (
          <ul id="live-feed">
            {feed.map((event) => (
              <li key={`${event.time}-${event.value.name}`}>
                <strong>{event.value.name === userName ? 'You' : event.value.name}</strong> just finished a round
                with a score of {event.value.score}. <small>{formatTime(event.time)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
