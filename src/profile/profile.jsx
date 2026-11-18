import React from 'react';
import { NavLink } from 'react-router-dom';
import { getHistory, UnauthorizedError } from '../services/scoreService';
import { formatDate, formatPercent, formatSeconds } from '../format';
import { ToneTable } from '../game/toneTable';

// Matches TONE_HISTORY_SIZE in service/database.js (only for the note's wording).
const TONE_HISTORY_SIZE = 5;

export function Profile({ userName, onSessionExpired }) {
  const [history, setHistory] = React.useState(null); // null while loading
  const [loadError, setLoadError] = React.useState('');
  // Dates of the rounds whose tone breakdown is showing. A Set, so several can be open at once.
  const [openRounds, setOpenRounds] = React.useState(() => new Set());

  function toggleRound(date) {
    setOpenRounds((prev) => {
      const next = new Set(prev); // a new Set, so React sees the change
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  React.useEffect(() => {
    let ignore = false;
    getHistory()
      .then((rounds) => {
        if (!ignore) setHistory(rounds);
      })
      .catch((err) => {
        if (ignore) return;
        if (err instanceof UnauthorizedError) {
          // Session gone: logging out makes App's /profile route redirect to Login.
          onSessionExpired();
        } else {
          setLoadError(err.message);
        }
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
        {loadError ? (
          <p className="text-danger" role="alert">{loadError}</p>
        ) : history === null ? (
          <p>Loading your rounds…</p>
        ) : history.length === 0 ? (
          <p>No rounds yet. <NavLink to="/game">Go play one!</NavLink></p>
        ) : (
          <div className="table-card">
            <div className="table-responsive">
              {/* Striped by hand (round-striped) instead of table-striped: Bootstrap
                  stripes every other <tr>, so an open breakdown row would flip
                  the stripes of every round below it. */}
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th><span className="visually-hidden">Tones</span></th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Accuracy</th>
                    <th>Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((round, index) => {
                    const isOpen = openRounds.has(round.date);
                    const breakdownId = `tones-${round.date}`;
                    return (
                      <React.Fragment key={round.date}>
                        <tr className={index % 2 === 0 ? 'round-striped' : undefined}>
                          <td>
                            {/* Only the newest rounds still have tones (the server prunes older ones). */}
                            {round.tones && (
                              <button
                                type="button"
                                className="tone-toggle"
                                aria-expanded={isOpen}
                                aria-controls={breakdownId}
                                aria-label={`Tone breakdown for the round on ${formatDate(round.date)}`}
                                onClick={() => toggleRound(round.date)}
                              >
                                {/* One arrow that CSS turns to point down when open. */}
                                <span className="tone-toggle-arrow" aria-hidden="true">▸</span>
                              </button>
                            )}
                          </td>
                          <td>{formatDate(round.date)}</td>
                          <td>{round.score}</td>
                          <td>{formatPercent(round.accuracy)}</td>
                          <td>{formatSeconds(round.avgTimeMs)}</td>
                        </tr>
                        {isOpen && (
                          <tr id={breakdownId} className="tone-breakdown">
                            <td colSpan={5}>
                              <ToneTable tones={round.tones} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {history?.length > 0 && (
          <p className="history-note">
            <small>Tone breakdowns are kept for your {TONE_HISTORY_SIZE} most recent rounds.</small>
          </p>
        )}
      </section>
    </main>
  );
}
