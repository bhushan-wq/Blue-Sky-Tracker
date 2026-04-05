const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { STATE_RULES } = require('./seed/state_rules_data');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'blue_sky.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema migration detection ────────────────────────────────────────────────
// Check if new columns exist; if not, drop and recreate all tables.
// (Safe to do because the user has no real data yet during initial setup.)
function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

const needsMigration = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='state_rules'"
).get() && !columnExists('state_rules', 'renewal_required');

if (needsMigration) {
  console.log('Schema migration: dropping and recreating tables with updated schema...');
  db.exec(`
    DROP TABLE IF EXISTS filings;
    DROP TABLE IF EXISTS investors;
    DROP TABLE IF EXISTS state_rules;
    DROP TABLE IF EXISTS funds;
  `);
}

// ── Create tables ─────────────────────────────────────────────────────────────
db.exec(`
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
`);

// ── Seed state_rules ──────────────────────────────────────────────────────────
const ruleCount = db.prepare('SELECT COUNT(*) as cnt FROM state_rules').get();
if (ruleCount.cnt === 0) {
  console.log('Seeding state rules...');
  const insertRule = db.prepare(`
    INSERT INTO state_rules (
      state_code, state_name, exemption_type, filing_required,
      form_name, filing_method, efd_eligible,
      deadline_days, filing_before_first_sale, days_before_first_sale, deadline_notes,
      fee_structure, fee_amount, fee_basis, fee_notes,
      late_fee_amount, late_fee_notes,
      renewal_required, renewal_period_days, renewal_fee, renewal_fee_notes,
      special_requirements, last_verified
    ) VALUES (
      @state_code, @state_name, @exemption_type, @filing_required,
      @form_name, @filing_method, @efd_eligible,
      @deadline_days, @filing_before_first_sale, @days_before_first_sale, @deadline_notes,
      @fee_structure, @fee_amount, @fee_basis, @fee_notes,
      @late_fee_amount, @late_fee_notes,
      @renewal_required, @renewal_period_days, @renewal_fee, @renewal_fee_notes,
      @special_requirements, @last_verified
    )
  `);

  const seedAll = db.transaction((rules) => {
    for (const rule of rules) {
      insertRule.run(rule);
    }
  });

  seedAll(STATE_RULES);
  console.log(`Seeded ${STATE_RULES.length} state rules.`);
}

module.exports = db;
