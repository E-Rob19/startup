import React from 'react';

export function Leaderboard() {
  return (
    <main>
      <section id="leaderboard">
        <h2>Global Leaderboard</h2>
        <p className="placeholder-tag">[Placeholder: Database Data]</p>
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
              <tr><td>1</td><td>frequencyfox</td><td>987</td><td>96%</td><td>1.8s</td></tr>
              <tr><td>2</td><td>mixmaster_jo</td><td>951</td><td>94%</td><td>2.1s</td></tr>
              <tr><td>3</td><td>ringout_ray</td><td>930</td><td>92%</td><td>2.4s</td></tr>
            </tbody>
          </table>
        </div>
        <p><small>Database placeholder: rows above stand in for scores that will be read from MongoDB.</small></p>
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
