import React from 'react';
import { getLeaderboard } from '../services/scoreService';
import { GameNotifier } from '../services/gameNotifier';
import { formatPercent, formatSeconds, formatTime } from '../format';

const LEADERBOARD_SIZE = 10;

// Adds live rounds into leaderboard rows: keeps each player's best round,
// highest first, top LEADERBOARD_SIZE. Merging the same round twice is harmless.
function mergeRounds(rows, rounds) {
  const bestByPlayer = new Map(rows.map((row) => [row.name, row]));
  for (const round of rounds) {
    const best = bestByPlayer.get(round.name);
    if (!best || round.score > best.score) {
      bestByPlayer.set(round.name, round);
    }
  }
  return [...bestByPlayer.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_SIZE);
}

function recentRounds() {
  return GameNotifier.getRecentEvents().map((event) => event.value);
}

export function Leaderboard({ userName }) {
  const [scores, setScores] = React.useState(null); // null while loading
  const [loadError, setLoadError] = React.useState('');
  const [feed, setFeed] = React.useState(() => GameNotifier.getRecentEvents());

  // Load the leaderboard from the server, then listen for live events.
  // Live rounds are merged into the table locally instead of reloading it:
  // fake players' rounds only exist in the live feed, not on the server.
  React.useEffect(() => {
    let ignore = false;

    // Recent live rounds (kept by the notifier, even while this page was
    // closed) are merged in too, so a fake player's new best doesn't vanish
    // when you leave and come back.
    getLeaderboard()
      .then((leaderboard) => {
        if (!ignore) setScores(mergeRounds(leaderboard, recentRounds()));
      })
      .catch((err) => {
        // The live feed below keeps working; only the table is missing.
        if (!ignore) setLoadError(err.message);
      });

    function handleGameEvent(event) {
      setFeed(GameNotifier.getRecentEvents());
      // Before the first load finishes there's nothing to merge into yet;
      // the load above will include this round from recentRounds().
      setScores((current) => (current ? mergeRounds(current, [event.value]) : current));
    }

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
        {loadError ? (
          <p className="text-danger" role="alert">{loadError}</p>
        ) : scores === null ? (
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
