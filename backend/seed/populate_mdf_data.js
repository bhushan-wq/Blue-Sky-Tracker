/**
 * MDF Blue Sky Tracker — Initial Data Population Script
 * Run from backend/ directory: node seed/populate_mdf_data.js
 *
 * Populates funds and blue sky filings from MDF's existing tracking data.
 * Sources: "Form D & Bluesky Tracking.xlsx" and counsel memo.
 *
 * NOTE: This script is safe to re-run (uses INSERT OR IGNORE / upsert logic).
 * Funds are matched by name to avoid duplicates.
 */

const db = require('../db'); // triggers schema creation + state rule seeding

// ── Fund data from Excel tracker ──────────────────────────────────────────────
// exemption_type: 'both' funds are marked as 506b by default;
// funds known to have run 506(c) offerings are marked 506c.

const FUNDS = [
  {
    name: 'AINA ALOHA ECONOMY FUND, LLC',
    exemption_type: '506c',   // Counsel memo: "as this offering was under 506(c)"
    status: 'active',
    edgar_cik: '0002063465',
    edgar_filing_date: '2025-03-31',
    next_annual_filing_date: '2026-03-31',
    notes: 'On-going offering. Annual federal Form D amendment due 2026-03-31.',
    // Blue sky: AK, CA, VT filed | AZ, HI not filed (further research)
    states_filed: ['AK', 'CA', 'VT'],
    states_pending: ['AZ', 'HI'],
    latest_filing_date: '2025-09-30',
    annual_renewal_due: '2026-09-30',
  },
  {
    name: 'CARE ACCESS REAL ESTATE INVESTMENTS, PBC',
    exemption_type: '506b',
    status: 'active',
    edgar_cik: '0001959133',
    edgar_filing_date: '2025-08-19',
    next_annual_filing_date: '2026-08-19',
    notes: 'On-going offering. CA filed — CA does not require annual filings.',
    states_filed: ['CA'],
    states_pending: [],
    latest_filing_date: '2023-10-02',
    annual_renewal_due: null,
  },
  {
    name: 'CARE INVESTMENT PARTNERS, LP',
    exemption_type: '506b',
    status: 'active',
    edgar_cik: '0001958799',
    edgar_filing_date: '2025-08-19',
    next_annual_filing_date: '2026-08-19',
    notes: 'On-going. CA, MI, MD previously filed and do not appear to expire. Further research on DC, HI, MA, MT, NV, RI, TX.',
    states_filed: ['CA', 'CO', 'ID', 'MD', 'MI', 'NJ', 'NM', 'NY', 'TX', 'WA'],
    states_pending: ['DC', 'HI', 'MA', 'MT', 'NV', 'RI'],
    latest_filing_date: '2025-10-10',
    annual_renewal_due: '2026-10-10',
  },
  {
    name: 'CARE PRI SPV I, LLC',
    exemption_type: '506b',
    status: 'active',
    edgar_cik: '0002063463',
    edgar_filing_date: '2025-09-30',
    next_annual_filing_date: '2026-09-30',
    notes: 'On-going offering.',
    states_filed: ['CA'],
    states_pending: [],
    latest_filing_date: '2025-09-30',
    annual_renewal_due: '2026-09-30',
  },
  {
    name: 'MDF CAPITAL PARTNERS 2023, LP',
    exemption_type: '506b',
    status: 'active',
    edgar_cik: '0002063462',
    edgar_filing_date: '2025-03-31',
    next_annual_filing_date: '2026-03-31',
    notes: 'On-going. Counsel recommends filing NY and PA. Exemption defensible for MA and DE.',
    states_filed: ['CA', 'CT', 'KS', 'NC', 'NY', 'PA', 'VT', 'WA'],
    states_pending: ['DE', 'MA'],
    latest_filing_date: '2025-09-30',
    annual_renewal_due: '2026-09-30',
  },
  {
    name: 'MDF FUND I, LP: LACI Asset Pool',
    exemption_type: '506b',
    status: 'active',
    edgar_cik: '0001763653',
    edgar_filing_date: '2025-08-25',
    next_annual_filing_date: '2026-08-25',
    notes: 'On-going offering.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: '2025-08-25',
    annual_renewal_due: '2026-08-25',
  },
  {
    name: 'MDF ADVANCE LLC',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001851183',
    edgar_filing_date: '2023-07-21',
    next_annual_filing_date: null,
    notes: 'Offering closed. Counsel recommends NY filing. AK/VT exemption research pending.',
    states_filed: ['CA', 'NC', 'NY', 'WA'],
    states_pending: ['HI'],
    latest_filing_date: '2025-10-23',
    annual_renewal_due: null,
  },
  {
    name: 'MDF FREEDOM 100, LLC',
    exemption_type: '506c',
    status: 'closed',
    edgar_cik: '0001818457',
    edgar_filing_date: '2023-07-11',
    next_annual_filing_date: null,
    notes: '506(c) offering, closed. Counsel recommends CA, IL, NY, WA. Exemptions defensible for multiple states.',
    states_filed: ['CA', 'IL', 'NY', 'WA'],
    states_pending: ['DC', 'HI', 'ID', 'MA', 'MD', 'ME', 'MI', 'MN', 'MT', 'NJ', 'OR', 'TX', 'VT'],
    latest_filing_date: '2025-10-15',
    annual_renewal_due: null,
  },
  {
    name: 'MDF POTM LLC',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001923305',
    edgar_filing_date: '2023-07-12',
    next_annual_filing_date: null,
    notes: 'Offering closed.',
    states_filed: ['IL'],
    states_pending: [],
    latest_filing_date: '2025-10-07',
    annual_renewal_due: null,
  },
  {
    name: 'OBRAN ACQUISITIONS FUND I, LLC',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001916956',
    edgar_filing_date: '2023-07-13',
    next_annual_filing_date: null,
    notes: 'Offering closed. Counsel recommends NY, WA. Exemptions defensible for DE, MA, MD, ME, MI, OR, VT.',
    states_filed: ['CA', 'CT', 'NY', 'WA'],
    states_pending: ['DE', 'MA', 'MD', 'ME', 'MI', 'OR', 'VT'],
    latest_filing_date: '2025-10-07',
    annual_renewal_due: null,
  },
  {
    name: 'PE FUND II, LLC',
    exemption_type: '506c',
    status: 'closed',
    edgar_cik: '0001917005',
    edgar_filing_date: '2023-07-12',
    next_annual_filing_date: null,
    notes: '506(c) offering, closed. Counsel notes PA: no exemption identified.',
    states_filed: ['CA', 'NY', 'WA'],
    states_pending: [],
    latest_filing_date: '2025-09-23',
    annual_renewal_due: null,
  },
  {
    name: 'MDF ADVANCE CALIFORNIA FUND, LLC',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0002057472',
    edgar_filing_date: '2025-02-21',
    next_annual_filing_date: null,
    notes: 'Offering closed.',
    states_filed: ['CA'],
    states_pending: [],
    latest_filing_date: '2025-10-09',
    annual_renewal_due: null,
  },
  {
    name: 'ADVANCE NEW MEXICO, LP',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0002065138',
    edgar_filing_date: '2025-04-21',
    next_annual_filing_date: null,
    notes: 'NM exemption: institutional investor exemption applies (NM Finance Authority >$10M assets). No blue sky filing required.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763643',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Multiple series/asset pools. Indiana exemption confirmed. See also sub-fund entities.',
    states_filed: ['CA', 'CO', 'IN', 'NC', 'WA'],
    states_pending: [],
    latest_filing_date: '2025-08-25',
    annual_renewal_due: null,
  },
  // Additional MDF Fund I series (from tracker)
  {
    name: 'MDF FUND I, LP: Advance California Asset Pool',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763644',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Advance Climate Asset Pool',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763645',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Advance Health',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763646',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Advance2025',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763647',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: AdvanceHer',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763648',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Cairnspring Asset Pool',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763649',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: EOCF Asset Pool',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763650',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Hilltop Asset Pool',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763651',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Homebuilding Investment Fund',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763652',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Regenerative Harvest Fund',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763654',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: rePlant Asset Pool',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763655',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: San Diego Habitat Homebuilding Asset Pool',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763656',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: Elevance Health Foundation Portfolio',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763657',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
  {
    name: 'MDF FUND I, LP: People on the Move',
    exemption_type: '506b',
    status: 'closed',
    edgar_cik: '0001763658',
    edgar_filing_date: null,
    next_annual_filing_date: null,
    notes: 'Sub-series of MDF Fund I, LP.',
    states_filed: [],
    states_pending: [],
    latest_filing_date: null,
    annual_renewal_due: null,
  },
];

// ── Main import ───────────────────────────────────────────────────────────────

const insertFund = db.prepare(`
  INSERT INTO funds (name, exemption_type, status, edgar_cik, edgar_filing_date,
                     next_annual_filing_date, notes)
  VALUES (@name, @exemption_type, @status, @edgar_cik, @edgar_filing_date,
          @next_annual_filing_date, @notes)
`);

const insertFiling = db.prepare(`
  INSERT OR IGNORE INTO filings
    (fund_id, state_code, filing_type, filing_year, is_renewal, status,
     filed_date, due_date_manual, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRenewal = db.prepare(`
  INSERT OR IGNORE INTO filings
    (fund_id, state_code, filing_type, filing_year, is_renewal, parent_filing_id,
     status, due_date, notes)
  VALUES (?, ?, 'renewal', 2, 1, ?, ?, ?, ?)
`);

let fundsCreated = 0;
let filingsCreated = 0;
let renewalsCreated = 0;

const populate = db.transaction(() => {
  for (const fund of FUNDS) {
    // Check if fund already exists
    const existing = db.prepare('SELECT id FROM funds WHERE name = ?').get(fund.name);
    if (existing) {
      console.log(`  SKIP (exists): ${fund.name}`);
      continue;
    }

    const result = insertFund.run({
      name: fund.name,
      exemption_type: fund.exemption_type,
      status: fund.status,
      edgar_cik: fund.edgar_cik || null,
      edgar_filing_date: fund.edgar_filing_date || null,
      next_annual_filing_date: fund.next_annual_filing_date || null,
      notes: fund.notes || null,
    });

    const fundId = result.lastInsertRowid;
    fundsCreated++;
    console.log(`  CREATED fund [${fundId}]: ${fund.name}`);

    // Create filed blue sky filings
    for (const state of (fund.states_filed || [])) {
      const r = insertFiling.run(
        fundId, state, 'notice', 1, 0, 'filed',
        fund.latest_filing_date || null,
        fund.latest_filing_date ? 1 : 0,
        `Imported from MDF tracker. Verify confirmation number.`
      );
      if (r.changes) filingsCreated++;

      // Check if annual renewal is required for this state
      const rule = db.prepare(`
        SELECT * FROM state_rules
        WHERE state_code = ? AND (exemption_type = 'both' OR exemption_type = ?)
        LIMIT 1
      `).get(state, fund.exemption_type);

      if (rule && rule.renewal_required && fund.annual_renewal_due) {
        const noticeFiling = db.prepare(
          'SELECT id FROM filings WHERE fund_id = ? AND state_code = ? AND filing_type = ? AND filing_year = 1'
        ).get(fundId, state, 'notice');

        if (noticeFiling) {
          const today = new Date().toISOString().split('T')[0];
          const renewalStatus = fund.annual_renewal_due < today ? 'overdue' : 'pending';
          const r2 = insertRenewal.run(
            fundId, state, noticeFiling.id,
            renewalStatus, fund.annual_renewal_due,
            `Annual renewal — due ${fund.annual_renewal_due}. Fee: $${rule.renewal_fee || 0}.`
          );
          if (r2.changes) renewalsCreated++;
        }
      }
    }

    // Create pending blue sky filings (states requiring further research)
    for (const state of (fund.states_pending || [])) {
      const r = insertFiling.run(
        fundId, state, 'notice', 1, 0, 'pending',
        null, 0,
        `Further research required. Counsel recommends evaluating available exemptions before filing.`
      );
      if (r.changes) filingsCreated++;
    }
  }
});

console.log('\nPopulating MDF fund data...');
populate();
console.log(`\nDone! Created: ${fundsCreated} funds, ${filingsCreated} filings, ${renewalsCreated} renewals.`);
console.log('Restart the backend to see data in the dashboard.\n');
