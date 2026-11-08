const express = require('express');

const app = express();

// The port can be passed on the command line (`node index.js 4000`).
// 4000 is the startup's port by course convention (Simon uses 3000).
const port = process.argv.length > 2 ? process.argv[2] : 4000;

// Parse JSON request bodies into req.body.
app.use(express.json());

// Every backend endpoint lives under /api, so it can never clash with a
// frontend route like /leaderboard.
const apiRouter = express.Router();
app.use('/api', apiRouter);

// Temporary endpoint to prove the service is running.
apiRouter.get('/health', (_req, res) => {
  res.send({ ok: true });
});

app.listen(port, () => {
  console.log(`EarShot service listening on port ${port}`);
});
