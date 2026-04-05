const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/funds — list all funds with investor counts and filing summary
router.get('/', async (req, res) => {
  try {
    await updateOverdueFilings();

    const fundsUpdated = await db.execute(`
      SELECT
        f.*,
        COUNT(DISTINCT i.id) as investor_count,
        SUM(CASE WHEN fi.status = 'pending' THEN 1 ELSE 0 END) as filings_pending,
        SUM(CASE WHEN fi.status = 'overdue' THEN 1 ELSE 0 END) as filings_overdue,
        SUM(CASE WHEN fi.status = 'filed' THEN 1 ELSE 0 END) as filings_filed,
        COUNT(DISTINCT fi.id) as filings_total
      FROM funds f
      LEFT JOIN investors i ON i.fund_id = f.id
      LEFT JOIN filings fi ON fi.fund_id = f.id
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `);

    res.json(fundsUpdated.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/funds/:id — get fund with full details
router.get('/:id', async (req, res) => {
  try {
    await updateOverdueFilings();
    
    const fundData = await db.execute({
      sql: 'SELECT * FROM funds WHERE id = ?',
      args: [req.params.id]
    });
    if (fundData.rows.length === 0) return res.status(404).json({ error: 'Fund not found' });
    const fund = fundData.rows[0];

    const investorsData = await db.execute({
      sql: 'SELECT * FROM investors WHERE fund_id = ? ORDER BY created_at DESC',
      args: [req.params.id]
    });

    const filingsData = await db.execute({
      sql: `
        SELECT fi.*, sr.state_name, sr.form_name, sr.filing_method, sr.deadline_days,
               sr.fee_structure, sr.fee_amount, sr.special_requirements
        FROM filings fi
        LEFT JOIN state_rules sr ON sr.state_code = fi.state_code AND (sr.exemption_type = 'both' OR sr.exemption_type = ?)
        WHERE fi.fund_id = ?
        ORDER BY fi.state_code ASC
      `,
      args: [fund.exemption_type, req.params.id]
    });

    res.json({ ...fund, investors: investorsData.rows, filings: filingsData.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/funds — create fund
router.post('/', async (req, res) => {
  try {
    const { name, exemption_type, first_sale_date, target_raise, status,
            edgar_cik, edgar_filing_date, next_annual_filing_date, notes } = req.body;
    if (!name || !exemption_type) {
      return res.status(400).json({ error: 'name and exemption_type are required' });
    }

    const result = await db.execute({
      sql: `
        INSERT INTO funds (name, exemption_type, first_sale_date, target_raise, status,
                           edgar_cik, edgar_filing_date, next_annual_filing_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *;
      `,
      args: [
        name, exemption_type, first_sale_date || null, target_raise || null, status || 'active',
        edgar_cik || null, edgar_filing_date || null, next_annual_filing_date || null, notes || null
      ]
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/funds/:id — update fund
router.put('/:id', async (req, res) => {
  try {
    const fundData = await db.execute({
      sql: 'SELECT * FROM funds WHERE id = ?',
      args: [req.params.id]
    });
    if (fundData.rows.length === 0) return res.status(404).json({ error: 'Fund not found' });
    const fund = fundData.rows[0];

    const { name, exemption_type, first_sale_date, target_raise, status,
            edgar_cik, edgar_filing_date, next_annual_filing_date, notes } = req.body;

    const newFirstSaleDate = first_sale_date !== undefined ? first_sale_date : fund.first_sale_date;

    await db.execute({
      sql: `
        UPDATE funds SET
          name = ?, exemption_type = ?, first_sale_date = ?, target_raise = ?, status = ?,
          edgar_cik = ?, edgar_filing_date = ?, next_annual_filing_date = ?, notes = ?
        WHERE id = ?
      `,
      args: [
        name ?? fund.name,
        exemption_type ?? fund.exemption_type,
        newFirstSaleDate,
        target_raise !== undefined ? target_raise : fund.target_raise,
        status ?? fund.status,
        edgar_cik !== undefined ? edgar_cik : fund.edgar_cik,
        edgar_filing_date !== undefined ? edgar_filing_date : fund.edgar_filing_date,
        next_annual_filing_date !== undefined ? next_annual_filing_date : fund.next_annual_filing_date,
        notes !== undefined ? notes : fund.notes,
        req.params.id
      ]
    });

    // If first_sale_date changed, recompute filing due dates
    if (first_sale_date !== undefined && first_sale_date !== fund.first_sale_date) {
      await recomputeDueDates(req.params.id, newFirstSaleDate);
    }

    const updated = await db.execute({
      sql: 'SELECT * FROM funds WHERE id = ?',
      args: [req.params.id]
    });
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/funds/:id — delete fund
router.delete('/:id', async (req, res) => {
  try {
    const fundData = await db.execute({
      sql: 'SELECT * FROM funds WHERE id = ?',
      args: [req.params.id]
    });
    if (fundData.rows.length === 0) return res.status(404).json({ error: 'Fund not found' });

    await db.execute({
      sql: 'DELETE FROM funds WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: mark filings overdue lazily
async function updateOverdueFilings() {
  const today = new Date().toISOString().split('T')[0];
  await db.execute({
    sql: `
      UPDATE filings
      SET status = 'overdue', updated_at = datetime('now')
      WHERE status = 'pending'
        AND due_date IS NOT NULL
        AND due_date < ?
    `,
    args: [today]
  });
}

// Helper: recompute due dates for all non-manual-override filings in a fund
async function recomputeDueDates(fundId, newFirstSaleDate) {
  if (!newFirstSaleDate) return;

  const filingsData = await db.execute({
    sql: `
      SELECT fi.*, sr.deadline_days
      FROM filings fi
      LEFT JOIN state_rules sr ON sr.state_code = fi.state_code
      WHERE fi.fund_id = ? AND fi.due_date_manual = 0
    `,
    args: [fundId]
  });

  const updateStatements = [];
  for (const filing of filingsData.rows) {
    if (filing.deadline_days != null) {
      const saleDate = new Date(newFirstSaleDate);
      saleDate.setDate(saleDate.getDate() + filing.deadline_days);
      const dueDate = saleDate.toISOString().split('T')[0];
      updateStatements.push({
        sql: `UPDATE filings SET due_date = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [dueDate, filing.id]
      });
    }
  }
  
  for (const stmt of updateStatements) {
     await db.execute(stmt);
  }
}

module.exports = router;
