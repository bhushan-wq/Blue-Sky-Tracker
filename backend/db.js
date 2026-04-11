const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const { STATE_RULES } = require('./seed/state_rules_data');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'blue_sky.db');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Ignore error in serverless environment where filesystem is read-only
  }
}

const dbUrl = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;

const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  try {
    // libSQL executeBatch is safe for schema initialization
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        exemption_type TEXT NOT NULL CHECK(exemption_type IN ('506b','506c')),
        first_sale_date TEXT,
        target_raise REAL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','closed','paused')),
        edgar_cik TEXT,
        edgar_filing_date TEXT,
        next_annual_filing_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS investors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        entity_name TEXT,
        state TEXT NOT NULL,
        pipeline_stage TEXT NOT NULL CHECK(pipeline_stage IN ('prospect','committed','closed')),
        commitment_amount REAL,
        is_accredited INTEGER DEFAULT 1,
        is_qualified_client INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS state_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_code TEXT NOT NULL,
        state_name TEXT NOT NULL,
        exemption_type TEXT NOT NULL CHECK(exemption_type IN ('506b','506c','both')),
        filing_required INTEGER NOT NULL DEFAULT 1,
        form_name TEXT,
        filing_method TEXT,
        efd_eligible INTEGER DEFAULT 1,
        deadline_days INTEGER,
        filing_before_first_sale INTEGER DEFAULT 0,
        days_before_first_sale INTEGER,
        deadline_notes TEXT,
        fee_structure TEXT,
        fee_amount REAL,
        fee_basis TEXT,
        fee_notes TEXT,
        late_fee_amount REAL,
        late_fee_notes TEXT,
        renewal_required INTEGER DEFAULT 0,
        renewal_period_days INTEGER,
        renewal_fee REAL,
        renewal_fee_notes TEXT,
        special_requirements TEXT,
        last_verified TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS filings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
        state_code TEXT NOT NULL,
        filing_type TEXT DEFAULT 'notice' CHECK(filing_type IN ('notice','renewal','amendment','termination')),
        filing_year INTEGER DEFAULT 1,
        is_renewal INTEGER DEFAULT 0,
        parent_filing_id INTEGER REFERENCES filings(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','filed','overdue','not_required','waived')),
        due_date TEXT,
        due_date_manual INTEGER DEFAULT 0,
        filed_date TEXT,
        confirmation_number TEXT,
        fee_paid REAL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(fund_id, state_code, filing_type, filing_year)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

    `);

    // Seed state_rules
    const ruleCount = await db.execute('SELECT COUNT(*) as cnt FROM state_rules');
    const cnt = Number(ruleCount.rows[0].cnt);
    
    if (cnt === 0) {
      console.log('Seeding state rules...');
      const statements = STATE_RULES.map(rule => {
        // Build SQL statement dynamically for executeMultiple if we don't want to use batch correctly, OR use transaction.
        // LibSQL has execute() for individual. Let's do a loop.
        return db.execute({
          sql: `INSERT INTO state_rules (
            state_code, state_name, exemption_type, filing_required,
            form_name, filing_method, efd_eligible,
            deadline_days, filing_before_first_sale, days_before_first_sale, deadline_notes,
            fee_structure, fee_amount, fee_basis, fee_notes,
            late_fee_amount, late_fee_notes,
            renewal_required, renewal_period_days, renewal_fee, renewal_fee_notes,
            special_requirements, last_verified
          ) VALUES (
            :state_code, :state_name, :exemption_type, :filing_required,
            :form_name, :filing_method, :efd_eligible,
            :deadline_days, :filing_before_first_sale, :days_before_first_sale, :deadline_notes,
            :fee_structure, :fee_amount, :fee_basis, :fee_notes,
            :late_fee_amount, :late_fee_notes,
            :renewal_required, :renewal_period_days, :renewal_fee, :renewal_fee_notes,
            :special_requirements, :last_verified
          )`,
          args: rule
        });
      });
      await Promise.all(statements);
      console.log(`Seeded ${STATE_RULES.length} state rules.`);
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Fire and forget init, or if in serverless it will just run on cold start. 
initDb();

module.exports = db;
