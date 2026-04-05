/**
 * Update first_sale_date for funds where it's known from the old tracker.
 * Also adds MDF AquaCycl 2020 LLC which was in old tracker but missing from new.
 * Source: "Securities Filings List - (as of May 2023).xlsx"
 */
const db = require('../db');

const updates = [
  { cik: '1818457', name: 'MDF FREEDOM 100, LLC',         first_sale_date: '2020-06-26' },
  { cik: '1851183', name: 'MDF ADVANCE LLC',               first_sale_date: '2020-12-11' },
  { cik: '1763643', name: 'MDF FUND I, LP',                first_sale_date: '2018-01-01' },
  { cik: '1917005', name: 'PE FUND II, LLC',               first_sale_date: '2021-11-02' },
  { cik: '1923305', name: 'MDF POTM LLC',                  first_sale_date: '2021-11-10' },
  { cik: '1916956', name: 'OBRAN ACQUISITIONS FUND I, LLC', first_sale_date: '2021-12-14' },
];

let updated = 0;
for (const u of updates) {
  // Try by CIK first, then by name
  let fund = db.prepare('SELECT id, name FROM funds WHERE edgar_cik = ? OR edgar_cik = ?')
               .get(u.cik, '0' + u.cik);
  if (!fund) {
    fund = db.prepare("SELECT id, name FROM funds WHERE name LIKE ?").get('%' + u.name.split(',')[0] + '%');
  }
  if (fund) {
    db.prepare('UPDATE funds SET first_sale_date = ? WHERE id = ?').run(u.first_sale_date, fund.id);
    console.log(`  Updated [${fund.id}] ${fund.name}: first_sale_date = ${u.first_sale_date}`);
    updated++;
  } else {
    console.log(`  NOT FOUND: ${u.name} (CIK ${u.cik})`);
  }
}

// Add MDF AquaCycl 2020 LLC (in old tracker, not in new)
const aquacycl = db.prepare("SELECT id FROM funds WHERE name LIKE '%AquaCycl%'").get();
if (!aquacycl) {
  const r = db.prepare(`
    INSERT INTO funds (name, exemption_type, status, edgar_cik, first_sale_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'MDF AQUACYCL 2020 LLC',
    '506b',
    'closed',
    '1916861',
    '2020-08-07',
    'In old tracker (as of May 2023). CA investors only. Verify current status.'
  );
  console.log(`  Added MDF AquaCycl 2020 LLC [id ${r.lastInsertRowid}]`);
} else {
  console.log('  MDF AquaCycl already exists, skipping.');
}

// Update Everytable PRI SPV with first sale date
const everytable = db.prepare("SELECT id FROM funds WHERE name LIKE '%EVERYTABLE PRI%'").get();
if (everytable) {
  db.prepare('UPDATE funds SET first_sale_date = ? WHERE id = ?').run('2020-04-14', everytable.id);
  console.log(`  Updated Everytable PRI SPV: first_sale_date = 2020-04-14`);
  updated++;
}

// Update MA state rule with correct tiered fee and Form U-2 requirement
const maRule = db.prepare("SELECT id FROM state_rules WHERE state_code = 'MA' AND exemption_type IN ('both','506b')").get();
if (maRule) {
  db.prepare(`
    UPDATE state_rules SET
      fee_amount = 250,
      fee_basis = 'tiered: $250 (0-$2M), $500 ($2M-$7.5M), $750 (>$7.5M)',
      fee_notes = 'Tiered: $250 for offerings 0-$2M; $500 for $2M-$7.5M; $750 for >$7.5M. Non-refundable.',
      special_requirements = 'Requires: (1) SEC Form D filed within 15 calendar days of first sale; (2) Form U-2 consent to service of process naming the Secretary; (3) filing fee. File with MA Securities Division. Exemption under M.G.L. c. 110A §402(b)(13).',
      updated_at = datetime('now')
    WHERE id = ?
  `, maRule.id).run();
  console.log('  Updated MA state rule with tiered fee and Form U-2 requirement.');
}

console.log(`\nDone. Updated ${updated} funds.`);
