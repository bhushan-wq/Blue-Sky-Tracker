const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function updateOverdueFilings(fundId) {
  const today = new Date().toISOString().split('T')[0];
  if (fundId) {
    await db.execute({
      sql: `UPDATE filings SET status = 'overdue', updated_at = datetime('now')
            WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < ? AND fund_id = ?`,
      args: [today, fundId]
    });
  } else {
    await db.execute({
      sql: `UPDATE filings SET status = 'overdue', updated_at = datetime('now')
            WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < ?`,
      args: [today]
    });
  }
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
async function createRenewalIfRequired(filing, fund) {
  const ruleData = await db.execute({
    sql: `
      SELECT * FROM state_rules
      WHERE state_code = ? AND (exemption_type = 'both' OR exemption_type = ?)
      LIMIT 1
    `,
    args: [filing.state_code, fund.exemption_type]
  });

  if (ruleData.rows.length === 0) return null;
  const rule = ruleData.rows[0];

  if (!rule.renewal_required) return null;

  const nextYear = filing.filing_year + 1;
  const existingData = await db.execute({
    sql: `
      SELECT id FROM filings
      WHERE fund_id = ? AND state_code = ? AND filing_type = 'renewal' AND filing_year = ?
    `,
    args: [filing.fund_id, filing.state_code, nextYear]
  });
  if (existingData.rows.length > 0) return existingData.rows[0];

  const dueDate = computeRenewalDueDate(filing.filed_date, rule);
  const today = new Date().toISOString().split('T')[0];
  const status = dueDate && dueDate < today ? 'overdue' : 'pending';

  const result = await db.execute({
    sql: `
      INSERT INTO filings (fund_id, state_code, filing_type, filing_year, is_renewal,
                           parent_filing_id, status, due_date)
      VALUES (?, ?, 'renewal', ?, 1, ?, ?, ?)
      RETURNING *;
    `,
    args: [filing.fund_id, filing.state_code, nextYear, filing.id, status, dueDate]
  });

  return result.rows[0];
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    await updateOverdueFilings();
    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().split('T')[0];
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);
    const in90Str = in90.toISOString().split('T')[0];

    const statusCountsData = await db.execute(`
      SELECT status, COUNT(*) as count FROM filings GROUP BY status
    `);

    const overdueData = await db.execute({
      sql: `
      SELECT fi.*, f.name as fund_name, f.exemption_type,
             CAST(julianday(?) - julianday(fi.due_date) AS INTEGER) as days_overdue
      FROM filings fi
      JOIN funds f ON f.id = fi.fund_id
      WHERE fi.status = 'overdue'
      ORDER BY fi.due_date ASC
      LIMIT 50
    `,
      args: [today]
    });

    const upcoming30Data = await db.execute({
      sql: `
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
    `,
      args: [today, today, in30Str]
    });

    const upcoming90Data = await db.execute({
      sql: `
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
    `,
      args: [today, in30Str, in90Str]
    });

    const totalFundsData = await db.execute("SELECT COUNT(*) as count FROM funds WHERE status = 'active'");
    const totalInvestorsData = await db.execute('SELECT COUNT(*) as count FROM investors');

    const fundSummariesData = await db.execute(`
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
    `);

    res.json({
      statusCounts: statusCountsData.rows,
      overdue: overdueData.rows,
      upcoming30: upcoming30Data.rows,
      upcoming90: upcoming90Data.rows,
      totalActiveFunds: totalFundsData.rows[0].count,
      totalInvestors: totalInvestorsData.rows[0].count,
      fundSummaries: fundSummariesData.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── List filings for a fund ───────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { fund_id } = req.query;
    if (!fund_id) return res.status(400).json({ error: 'fund_id required' });

    await updateOverdueFilings(fund_id);

    const fundData = await db.execute({ sql: 'SELECT * FROM funds WHERE id = ?', args: [fund_id] });
    if (fundData.rows.length === 0) return res.status(404).json({ error: 'Fund not found' });
    const fund = fundData.rows[0];

    const filingsData = await db.execute({
      sql: `
        SELECT
          fi.*,
          sr.state_name, sr.form_name, sr.filing_method, sr.efd_eligible, sr.deadline_days,
          sr.filing_before_first_sale, sr.days_before_first_sale, sr.deadline_notes,
          sr.fee_structure, sr.fee_amount, sr.fee_notes, sr.late_fee_amount, sr.late_fee_notes,
          sr.renewal_required, sr.renewal_period_days, sr.renewal_fee, sr.renewal_fee_notes,
          sr.special_requirements, sr.last_verified,
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
          fi.state_code ASC, fi.filing_year ASC
      `,
      args: [fund.exemption_type, fund_id]
    });

    res.json(filingsData.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Create filing (manual) ────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const {
      fund_id, state_code, filing_type, filing_year, status,
      due_date, filed_date, confirmation_number, fee_paid, notes,
      is_renewal, parent_filing_id
    } = req.body;

    if (!fund_id || !state_code) {
      return res.status(400).json({ error: 'fund_id and state_code are required' });
    }

    const result = await db.execute({
      sql: `
        INSERT OR REPLACE INTO filings
          (fund_id, state_code, filing_type, filing_year, is_renewal, parent_filing_id,
           status, due_date, due_date_manual, filed_date, confirmation_number, fee_paid, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *;
      `,
      args: [
        fund_id, state_code.toUpperCase(), filing_type || 'notice', filing_year || 1,
        is_renewal ? 1 : 0, parent_filing_id || null, status || 'pending', due_date || null,
        due_date ? 1 : 0, filed_date || null, confirmation_number || null, fee_paid || null, notes || null
      ]
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk import historical filings ────────────────────────────────────────────

router.post('/bulk-import', async (req, res) => {
  try {
    const { filings } = req.body;
    if (!Array.isArray(filings) || filings.length === 0) {
      return res.status(400).json({ error: 'filings array is required' });
    }

    let imported = 0;
    let errors = [];

    const tx = await db.transaction('write');
    try {
      for (const row of filings) {
        try {
          const { fund_id, state_code, filing_type, filing_year, status,
                  due_date, filed_date, confirmation_number, fee_paid, notes,
                  is_renewal, parent_filing_id } = row;
          if (!fund_id || !state_code) {
            errors.push({ row, error: 'fund_id and state_code are required' });
            continue;
          }
          await tx.execute({
            sql: `
              INSERT OR REPLACE INTO filings
                (fund_id, state_code, filing_type, filing_year, is_renewal, parent_filing_id,
                 status, due_date, due_date_manual, filed_date, confirmation_number, fee_paid, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              fund_id, state_code.toUpperCase(), filing_type || 'notice', filing_year || 1,
              is_renewal ? 1 : 0, parent_filing_id || null, status || 'filed', due_date || null,
              due_date ? 1 : 0, filed_date || null, confirmation_number || null, fee_paid || null, notes || null
            ]
          });
          imported++;
        } catch (e) {
          errors.push({ row, error: e.message });
        }
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    // Auto-create renewal filings for imported filings that require them
    const importedFilingsData = await db.execute(`
      SELECT fi.*, f.exemption_type FROM filings fi
      JOIN funds f ON f.id = fi.fund_id
      WHERE fi.status = 'filed' AND fi.filed_date IS NOT NULL
        AND fi.filing_type = 'notice'
    `);

    let renewalsCreated = 0;
    for (const f of importedFilingsData.rows) {
      const renewal = await createRenewalIfRequired(f, { exemption_type: f.exemption_type });
      if (renewal && renewal.id) renewalsCreated++;
    }

    res.json({ imported, renewalsCreated, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update filing ─────────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  try {
    const filingData = await db.execute({ sql: 'SELECT * FROM filings WHERE id = ?', args: [req.params.id] });
    if (filingData.rows.length === 0) return res.status(404).json({ error: 'Filing not found' });
    const filing = filingData.rows[0];

    const fundData = await db.execute({ sql: 'SELECT * FROM funds WHERE id = ?', args: [filing.fund_id] });
    const fund = fundData.rows[0];

    const {
      status, filed_date, due_date, confirmation_number, fee_paid, notes, filing_type
    } = req.body;

    const newStatus = status ?? filing.status;
    const newFiledDate = filed_date !== undefined ? filed_date : filing.filed_date;
    const newDueDate = due_date !== undefined ? due_date : filing.due_date;
    const dueDateManual = due_date !== undefined ? 1 : filing.due_date_manual;

    const updatedData = await db.execute({
      sql: `
        UPDATE filings SET
          status = ?, filing_type = ?, filed_date = ?, due_date = ?, due_date_manual = ?,
          confirmation_number = ?, fee_paid = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
        RETURNING *;
      `,
      args: [
        newStatus, filing_type ?? filing.filing_type, newFiledDate, newDueDate, dueDateManual,
        confirmation_number !== undefined ? confirmation_number : filing.confirmation_number,
        fee_paid !== undefined ? fee_paid : filing.fee_paid, notes !== undefined ? notes : filing.notes,
        req.params.id
      ]
    });

    const updated = updatedData.rows[0];

    // Auto-create renewal when filing is marked as filed
    let renewal = null;
    if (newStatus === 'filed' && filing.status !== 'filed' && newFiledDate && fund) {
      renewal = await createRenewalIfRequired(updated, fund);
    }

    res.json({ filing: updated, renewal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Delete filing ─────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const filingData = await db.execute({ sql: 'SELECT * FROM filings WHERE id = ?', args: [req.params.id] });
    if (filingData.rows.length === 0) return res.status(404).json({ error: 'Filing not found' });
    
    await db.execute({ sql: 'DELETE FROM filings WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Recompute due dates for a fund ────────────────────────────────────────────

router.post('/recompute/:fund_id', async (req, res) => {
  try {
    const fundData = await db.execute({ sql: 'SELECT * FROM funds WHERE id = ?', args: [req.params.fund_id] });
    if (fundData.rows.length === 0) return res.status(404).json({ error: 'Fund not found' });
    const fund = fundData.rows[0];

    if (!fund.first_sale_date) {
      return res.status(400).json({ error: 'Fund has no first_sale_date set' });
    }

    const filingsData = await db.execute({
      sql: `
        SELECT fi.id, fi.status, fi.is_renewal, fi.filed_date, sr.deadline_days,
               sr.filing_before_first_sale, sr.days_before_first_sale, sr.renewal_period_days
        FROM filings fi
        LEFT JOIN state_rules sr ON sr.state_code = fi.state_code
          AND (sr.exemption_type = 'both' OR sr.exemption_type = ?)
        WHERE fi.fund_id = ? AND fi.due_date_manual = 0
      `,
      args: [fund.exemption_type, req.params.fund_id]
    });

    const today = new Date().toISOString().split('T')[0];
    let updated = 0;

    for (const f of filingsData.rows) {
      let dueDate;
      if (f.is_renewal) {
        continue;
      } else {
        dueDate = computeDueDate(fund.first_sale_date, f);
      }
      if (dueDate) {
        const newStatus = f.status === 'filed' ? 'filed' : (dueDate < today ? 'overdue' : 'pending');
        await db.execute({
          sql: `UPDATE filings SET due_date = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [dueDate, newStatus, f.id]
        });
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
