const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateOverdueFilings(fundId) {
  const today = new Date().toISOString().split('T')[0];
  const query = fundId
    ? `UPDATE filings SET status = 'overdue', updated_at = datetime('now')
       WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < ? AND fund_id = ?`
    : `UPDATE filings SET status = 'overdue', updated_at = datetime('now')
       WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < ?`;
  if (fundId) db.prepare(query).run(today, fundId);
  else db.prepare(query).run(today);
}

// Compute due date from rule + first_sale_date
function computeDueDate(firstSaleDate, rule) {
  if (!firstSaleDate || !rule) return null;
  const base = new Date(firstSaleDate + 'T12:00:00Z');
  if (rule.filing_before_first_sale && rule.days_before_first_sale != null) {
    base.setDate(base.getDate() - rule.days_before_first_sale);
  } else if (rule.deadline_days != null) {
    base.setDate(base.getDate() + rule.deadline_days);
  } else {
    return null;
  }
  return base.toISOString().split('T')[0];
}

// Compute renewal due date: filing_date + renewal_period_days
function computeRenewalDueDate(filedDate, rule) {
  if (!filedDate || !rule || !rule.renewal_period_days) return null;
  const d = new Date(filedDate + 'T12:00:00Z');
  d.setDate(d.getDate() + rule.renewal_period_days);
  return d.toISOString().split('T')[0];
}

// Auto-create a renewal filing when parent notice is marked filed
function createRenewalIfRequired(filing, fund) {
  const rule = db.prepare(`
    SELECT * FROM state_rules
    WHERE state_code = ? AND (exemption_type = 'both' OR exemption_type = ?)
    LIMIT 1
  `).get(filing.state_code, fund.exemption_type);

  if (!rule || !rule.renewal_required) return null;

  const nextYear = filing.filing_year + 1;
  const existing = db.prepare(`
    SELECT id FROM filings
    WHERE fund_id = ? AND state_code = ? AND filing_type = 'renewal' AND filing_year = ?
  `).get(filing.fund_id, filing.state_code, nextYear);
  if (existing) return existing;

  const dueDate = computeRenewalDueDate(filing.filed_date, rule);
  const today = new Date().toISOString().split('T')[0];
  const status = dueDate && dueDate < today ? 'overdue' : 'pending';

  const result = db.prepare(`
    INSERT INTO filings (fund_id, state_code, filing_type, filing_year, is_renewal,
                         parent_filing_id, status, due_date)
    VALUES (?, ?, 'renewal', ?, 1, ?, ?, ?)
  `).run(filing.fund_id, filing.state_code, nextYear, filing.id, status, dueDate);

  return db.prepare('SELECT * FROM filings WHERE id = ?').get(result.lastInsertRowid);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  try {
    updateOverdueFilings();
    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().split('T')[0];
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);
    const in90Str = in90.toISOString().split('T')[0];

    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM filings GROUP BY status
    `).all();

    const overdue = db.prepare(`
      SELECT fi.*, f.name as fund_name, f.exemption_type,
             CAST(julianday(?) - julianday(fi.due_date) AS INTEGER) as days_overdue
      FROM filings fi
      JOIN funds f ON f.id = fi.fund_id
      WHERE fi.status = 'overdue'
      ORDER BY fi.due_date ASC
      LIMIT 50
    `).all(today);

    const upcoming30 = db.prepare(`
      SELECT fi.*, f.name as fund_name, f.exemption_type,
             CAST(julianday(fi.due_date) - julianday(?) AS INTEGER) as days_until_due
      FROM filings fi
      JOIN funds f ON f.id = fi.fund_id
      WHERE fi.status = 'pending'
        AND fi.due_date IS NOT NULL
        AND fi.due_date >= ?
        AND fi.due_date <= ?
      ORDER BY fi.due_date ASC
      LIMIT 50
    `).all(today, today, in30Str);

    const upcoming90 = db.prepare(`
      SELECT fi.*, f.name as fund_name, f.exemption_type,
             CAST(julianday(fi.due_date) - julianday(?) AS INTEGER) as days_until_due
      FROM filings fi
      JOIN funds f ON f.id = fi.fund_id
      WHERE fi.status = 'pending'
        AND fi.due_date IS NOT NULL
        AND fi.due_date > ?
        AND fi.due_date <= ?
      ORDER BY fi.due_date ASC
      LIMIT 50
    `).all(today, in30Str, in90Str);

    const totalFunds = db.prepare("SELECT COUNT(*) as count FROM funds WHERE status = 'active'").get();
    const totalInvestors = db.prepare('SELECT COUNT(*) as count FROM investors').get();

    const fundSummaries = db.prepare(`
      SELECT
        f.id, f.name, f.exemption_type, f.status, f.first_sale_date,
        COUNT(DISTINCT i.id) as investor_count,
        SUM(CASE WHEN fi.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN fi.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN fi.status = 'filed' THEN 1 ELSE 0 END) as filed_count
      FROM funds f
      LEFT JOIN investors i ON i.fund_id = f.id
      LEFT JOIN filings fi ON fi.fund_id = f.id
      GROUP BY f.id
      ORDER BY f.name ASC
    `).all();

    res.json({
      statusCounts,
      overdue,
      upcoming30,
      upcoming90,
      totalActiveFunds: totalFunds.count,
      totalInvestors: totalInvestors.count,
      fundSummaries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── List filings for a fund ───────────────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    const { fund_id } = req.query;
    if (!fund_id) return res.status(400).json({ error: 'fund_id required' });

    updateOverdueFilings(fund_id);

    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(fund_id);
    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const filings = db.prepare(`
      SELECT
        fi.*,
        sr.state_name,
        sr.form_name,
        sr.filing_method,
        sr.efd_eligible,
        sr.deadline_days,
        sr.filing_before_first_sale,
        sr.days_before_first_sale,
        sr.deadline_notes,
        sr.fee_structure,
        sr.fee_amount,
        sr.fee_notes,
        sr.late_fee_amount,
        sr.late_fee_notes,
        sr.renewal_required,
        sr.renewal_period_days,
        sr.renewal_fee,
        sr.renewal_fee_notes,
        sr.special_requirements,
        sr.last_verified,
        COUNT(DISTINCT i.id) as investor_count
      FROM filings fi
      LEFT JOIN state_rules sr ON sr.state_code = fi.state_code
        AND (sr.exemption_type = 'both' OR sr.exemption_type = ?)
      LEFT JOIN investors i ON i.fund_id = fi.fund_id
        AND i.state = fi.state_code
        AND (i.pipeline_stage = 'committed' OR i.pipeline_stage = 'closed')
      WHERE fi.fund_id = ?
      GROUP BY fi.id
      ORDER BY
        CASE fi.status WHEN 'overdue' THEN 1 WHEN 'pending' THEN 2 WHEN 'filed' THEN 3 ELSE 4 END,
        fi.state_code ASC,
        fi.filing_year ASC
    `).all(fund.exemption_type, fund_id);

    res.json(filings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Create filing (manual) ────────────────────────────────────────────────────

router.post('/', (req, res) => {
  try {
    const {
      fund_id, state_code, filing_type, filing_year, status,
      due_date, filed_date, confirmation_number, fee_paid, notes,
      is_renewal, parent_filing_id
    } = req.body;

    if (!fund_id || !state_code) {
      return res.status(400).json({ error: 'fund_id and state_code are required' });
    }

    const result = db.prepare(`
      INSERT OR REPLACE INTO filings
        (fund_id, state_code, filing_type, filing_year, is_renewal, parent_filing_id,
         status, due_date, due_date_manual, filed_date, confirmation_number, fee_paid, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fund_id,
      state_code.toUpperCase(),
      filing_type || 'notice',
      filing_year || 1,
      is_renewal ? 1 : 0,
      parent_filing_id || null,
      status || 'pending',
      due_date || null,
      due_date ? 1 : 0,
      filed_date || null,
      confirmation_number || null,
      fee_paid || null,
      notes || null
    );

    const filing = db.prepare('SELECT * FROM filings WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(filing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk import historical filings ────────────────────────────────────────────

router.post('/bulk-import', (req, res) => {
  try {
    const { filings } = req.body;
    if (!Array.isArray(filings) || filings.length === 0) {
      return res.status(400).json({ error: 'filings array is required' });
    }

    const insert = db.prepare(`
      INSERT OR REPLACE INTO filings
        (fund_id, state_code, filing_type, filing_year, is_renewal, parent_filing_id,
         status, due_date, due_date_manual, filed_date, confirmation_number, fee_paid, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    let errors = [];

    const importAll = db.transaction((rows) => {
      for (const row of rows) {
        try {
          const { fund_id, state_code, filing_type, filing_year, status,
                  due_date, filed_date, confirmation_number, fee_paid, notes,
                  is_renewal, parent_filing_id } = row;
          if (!fund_id || !state_code) {
            errors.push({ row, error: 'fund_id and state_code are required' });
            continue;
          }
          insert.run(
            fund_id,
            state_code.toUpperCase(),
            filing_type || 'notice',
            filing_year || 1,
            is_renewal ? 1 : 0,
            parent_filing_id || null,
            status || 'filed',
            due_date || null,
            due_date ? 1 : 0,
            filed_date || null,
            confirmation_number || null,
            fee_paid || null,
            notes || null
          );
          imported++;
        } catch (e) {
          errors.push({ row, error: e.message });
        }
      }
    });

    importAll(filings);

    // Auto-create renewal filings for imported filings that require them
    const importedFilings = db.prepare(`
      SELECT fi.*, f.exemption_type FROM filings fi
      JOIN funds f ON f.id = fi.fund_id
      WHERE fi.status = 'filed' AND fi.filed_date IS NOT NULL
        AND fi.filing_type = 'notice'
    `).all();

    let renewalsCreated = 0;
    for (const f of importedFilings) {
      const renewal = createRenewalIfRequired(f, { exemption_type: f.exemption_type });
      if (renewal && renewal.id) renewalsCreated++;
    }

    res.json({ imported, renewalsCreated, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update filing ─────────────────────────────────────────────────────────────

router.put('/:id', (req, res) => {
  try {
    const filing = db.prepare('SELECT * FROM filings WHERE id = ?').get(req.params.id);
    if (!filing) return res.status(404).json({ error: 'Filing not found' });

    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(filing.fund_id);

    const {
      status, filed_date, due_date, confirmation_number,
      fee_paid, notes, filing_type
    } = req.body;

    const newStatus = status ?? filing.status;
    const newFiledDate = filed_date !== undefined ? filed_date : filing.filed_date;
    const newDueDate = due_date !== undefined ? due_date : filing.due_date;
    const dueDateManual = due_date !== undefined ? 1 : filing.due_date_manual;

    db.prepare(`
      UPDATE filings SET
        status = ?,
        filing_type = ?,
        filed_date = ?,
        due_date = ?,
        due_date_manual = ?,
        confirmation_number = ?,
        fee_paid = ?,
        notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      newStatus,
      filing_type ?? filing.filing_type,
      newFiledDate,
      newDueDate,
      dueDateManual,
      confirmation_number !== undefined ? confirmation_number : filing.confirmation_number,
      fee_paid !== undefined ? fee_paid : filing.fee_paid,
      notes !== undefined ? notes : filing.notes,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM filings WHERE id = ?').get(req.params.id);

    // Auto-create renewal when filing is marked as filed
    let renewal = null;
    if (newStatus === 'filed' && filing.status !== 'filed' && newFiledDate && fund) {
      renewal = createRenewalIfRequired(updated, fund);
    }

    res.json({ filing: updated, renewal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Delete filing ─────────────────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  try {
    const filing = db.prepare('SELECT * FROM filings WHERE id = ?').get(req.params.id);
    if (!filing) return res.status(404).json({ error: 'Filing not found' });
    db.prepare('DELETE FROM filings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Recompute due dates for a fund ────────────────────────────────────────────

router.post('/recompute/:fund_id', (req, res) => {
  try {
    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(req.params.fund_id);
    if (!fund) return res.status(404).json({ error: 'Fund not found' });
    if (!fund.first_sale_date) {
      return res.status(400).json({ error: 'Fund has no first_sale_date set' });
    }

    const filings = db.prepare(`
      SELECT fi.id, fi.status, fi.is_renewal, fi.filed_date, sr.deadline_days,
             sr.filing_before_first_sale, sr.days_before_first_sale, sr.renewal_period_days
      FROM filings fi
      LEFT JOIN state_rules sr ON sr.state_code = fi.state_code
        AND (sr.exemption_type = 'both' OR sr.exemption_type = ?)
      WHERE fi.fund_id = ? AND fi.due_date_manual = 0
    `).all(fund.exemption_type, req.params.fund_id);

    const today = new Date().toISOString().split('T')[0];
    let updated = 0;

    for (const f of filings) {
      let dueDate;
      if (f.is_renewal) {
        // Renewal due dates are tied to filed_date of parent, not first_sale_date
        // Skip recompute for renewals — they have their own logic
        continue;
      } else {
        dueDate = computeDueDate(fund.first_sale_date, f);
      }
      if (dueDate) {
        const newStatus = f.status === 'filed' ? 'filed' : (dueDate < today ? 'overdue' : 'pending');
        db.prepare(`
          UPDATE filings SET due_date = ?, status = ?, updated_at = datetime('now') WHERE id = ?
        `).run(dueDate, newStatus, f.id);
        updated++;
      }
    }

    res.json({ success: true, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
