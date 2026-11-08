import React from 'react';
import { NavLink } from 'react-router-dom';
import { getHistory, UnauthorizedError } from '../services/scoreService';
import { formatDate, formatPercent, formatSeconds } from '../format';

export function Profile({ userName, onSessionExpired }) {
  const [history, setHistory] = React.useState(null); // null while loading

  React.useEffect(() => {
    let ignore = false;
    getHistory()
      .then((rounds) => {
        if (!ignore) setHistory(rounds);
      })
      .catch((err) => {
        // Session gone: logging out makes App's /profile route redirect to Login.
        if (!ignore && err instanceof UnauthorizedError) onSessionExpired();
      });
    return () => {
      ignore = true;
    };
  }, [userName, onSessionExpired]);

  const bestScore = history?.length ? Math.max(...history.map((round) => round.score)) : null;
  const averageScore = history?.length
    ? Math.round(history.reduce((sum, round) => sum + round.score, 0) / history.length)
    : null;

  return (
    <main>
      <section id="profile-header">
        <h2><span id="profile-username">{userName}</span>'s Profile</h2>
        {history?.length > 0 && (
          <p>
            Rounds played: <strong>{history.length}</strong> · Best score: <strong>{bestScore}</strong> ·
            Average score: <strong>{averageScore}</strong>
          </p>
        )}
      </section>

      <section id="round-history">
        <h2>Round History</h2>
        {history === null ? (
          <p>Loading your rounds…</p>
        ) : history.length === 0 ? (
          <p>No rounds yet. <NavLink to="/game">Go play one!</NavLink></p>
        ) : (
          <div className="table-card">
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Accuracy</th>
                    <th>Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((round) => (
                    <tr key={round.date}>
                      <td>{formatDate(round.date)}</td>
                      <td>{round.score}</td>
                      <td>{formatPercent(round.accuracy)}</td>
                      <td>{formatSeconds(round.avgTimeMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
