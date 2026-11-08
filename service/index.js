const path = require('path');
const express = require('express');

const app = express();

// The built React app (Vite's dist/ output) is copied here when deploying.
// Using __dirname makes the path work no matter which folder node is started from.
const publicDir = path.join(__dirname, 'public');

// The port can be passed on the command line (`node index.js 4000`).
// 4000 is the startup's port by course convention (Simon uses 3000).
const port = process.argv.length > 2 ? process.argv[2] : 4000;

// Parse JSON request bodies into req.body.
app.use(express.json());

// Serve the frontend's static files (index.html, the JS/CSS bundles, images).
app.use(express.static(publicDir));

// Every backend endpoint lives under /api, so it can never clash with a
// frontend route like /leaderboard.
const apiRouter = express.Router();
app.use('/api', apiRouter);

// Temporary endpoint to prove the service is running.
apiRouter.get('/health', (_req, res) => {
  res.send({ ok: true });
});

// Any other request is a React Router page (/leaderboard, /profile, ...).
// There's no leaderboard.html file, so send index.html and let React Router
// pick the page in the browser. This must come after the static and API
// middleware so it only catches what they didn't handle.
app.use((_req, res) => {
  res.sendFile('index.html', { root: publicDir });
});

app.listen(port, () => {
  console.log(`EarShot service listening on port ${port}`);
});
