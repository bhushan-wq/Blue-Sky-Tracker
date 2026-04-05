const db = require('../db');

const placeholderFunds = [
  { name: 'EVERYTABLE PRI SPV I, PBC', notes: 'Pipeline fund — no Form D or blue sky filings yet. CIK not assigned.' },
  { name: 'EVERYTABLE SOCIAL EQUITY FUND, LLC', notes: 'Pipeline fund — no Form D or blue sky filings yet. CIK not assigned.' },
  { name: 'HHI POOL FACILITY I, LLC', notes: 'Pipeline fund — no Form D or blue sky filings yet. CIK not assigned.' },
  { name: 'LACI CLEANTECH DEBT FUND, LP', notes: 'Pipeline fund — no Form D or blue sky filings yet. CIK not assigned.' },
  { name: 'INITIATIVE FOR INCLUSIVE ENTREPENEURSHIP, LLC', notes: 'Pipeline fund — no Form D or blue sky filings yet. CIK not assigned.' },
  { name: 'WEPOWER ELEVATE/ELEVAR CAPITAL INC.', notes: 'Pipeline fund — no Form D or blue sky filings yet. CIK not assigned.' },
];

const insert = db.prepare('INSERT INTO funds (name, exemption_type, status, notes) VALUES (?, ?, ?, ?)');
let created = 0;
for (const f of placeholderFunds) {
  const exists = db.prepare('SELECT id FROM funds WHERE name = ?').get(f.name);
  if (!exists) {
    insert.run(f.name, '506b', 'paused', f.notes);
    created++;
    console.log('  Added:', f.name);
  } else {
    console.log('  Skip (exists):', f.name);
  }
}
console.log('Done. Added', created, 'placeholder funds.');

// Update CARE ACCESS note about Ontario
const careAccess = db.prepare("SELECT id FROM funds WHERE name LIKE '%CARE ACCESS%'").get();
if (careAccess) {
  db.prepare("UPDATE funds SET notes = notes || ' NOTE: Tracker lists Ontario (Canada) as a jurisdiction — not a US state, no US blue sky filing required for that investor.' WHERE id = ?").run(careAccess.id);
  console.log('Updated CARE ACCESS note re: Ontario.');
}
