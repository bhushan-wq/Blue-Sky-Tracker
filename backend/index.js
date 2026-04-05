const express = require('express');
const cors = require('cors');

const fundsRouter = require('./routes/funds');
const investorsRouter = require('./routes/investors');
const filingsRouter = require('./routes/filings');
const stateRulesRouter = require('./routes/state_rules');

// Initialize DB (runs schema + seed)
require('./db');

const app = express();
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/funds', fundsRouter);
app.use('/api/investors', investorsRouter);
app.use('/api/filings', filingsRouter);
app.use('/api/state-rules', stateRulesRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Blue Sky Tracker API running on http://localhost:${PORT}`);
});
