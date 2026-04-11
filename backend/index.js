require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('dotenv').config();
const fundsRouter = require('./routes/funds');
const investorsRouter = require('./routes/investors');
const filingsRouter = require('./routes/filings');
const stateRulesRouter = require('./routes/state_rules');
const authRouter = require('./routes/auth');

console.log('Routes loaded:', {
  funds: typeof fundsRouter,
  investors: typeof investorsRouter,
  filings: typeof filingsRouter,
  rules: typeof stateRulesRouter,
  auth: typeof authRouter
});
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');


// Initialize DB (runs schema + seed)
require('./db');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // allow all or configure specifically
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'blue-sky-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
const apiRouter = express.Router();
apiRouter.use('/funds', fundsRouter);
apiRouter.use('/investors', investorsRouter);
apiRouter.use('/filings', filingsRouter);
apiRouter.use('/state-rules', stateRulesRouter);
apiRouter.use('/auth', authRouter);

// Local dev usually sends /api/..., Vercel's routePrefix might send /...
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 404 handler for API
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Blue Sky Tracker API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
