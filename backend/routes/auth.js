const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

const router = express.Router();

// Passport configuration
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('Initializing Google Strategy...');
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
      proxy: true
    },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      const result = await db.execute({
        sql: "SELECT * FROM users WHERE google_id = ?",
        args: [profile.id]
      });

      let user = result.rows[0];

      if (!user) {
        // Create user if not exists
        await db.execute({
          sql: "INSERT INTO users (google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)",
          args: [
            profile.id,
            profile.emails[0].value,
            profile.displayName,
            profile.photos[0]?.value
          ]
        });
        
        const newResult = await db.execute({
          sql: "SELECT * FROM users WHERE google_id = ?",
          args: [profile.id]
        });
        user = newResult.rows[0];
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));
} else {
  console.warn('Google OAuth credentials missing. Google login will be disabled.');
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id]
    });
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// Routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to dashboard.
    const redirectUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
    res.redirect(redirectUrl);
  }
);

router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.json({ success: true });
  });
});

module.exports = router;
