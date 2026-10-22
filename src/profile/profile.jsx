import React from 'react';

export function Profile({ userName, authState }) {
  return (
    <main>
      <section id="profile-header">
        <h2><span id="profile-username">{userName || 'Guest'}</span>'s Profile</h2>
        <p>Your personal round history and improvement over time will show up here once you're logged in.</p>
      </section>

      <section id="round-history">
        <h2>Round History</h2>
        <p className="placeholder-tag">[Placeholder: Database Data]</p>
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
                <tr><td>2026-09-18</td><td>930</td><td>92%</td><td>2.4s</td></tr>
                <tr><td>2026-09-15</td><td>875</td><td>88%</td><td>2.7s</td></tr>
                <tr><td>2026-09-10</td><td>810</td><td>84%</td><td>3.1s</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <p><small>Database placeholder: rows above stand in for this player's past rounds, which will be read from MongoDB.</small></p>
      </section>
    </main>
  );
}
