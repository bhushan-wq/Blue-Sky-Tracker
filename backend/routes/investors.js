const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: compute due date from first_sale_date + deadline_days
function computeDueDate(firstSaleDate, deadlineDays) {
  if (!firstSaleDate || deadlineDays == null) return null;
  const d = new Date(firstSaleDate);
  d.setDate(d.getDate() + deadlineDays);
  return d.toISOString().split('T')[0];
}

// Helper: auto-create filing obligation when investor is committed or closed
async function checkAndCreateFiling(fundId, stateCode, fundExemptionType, firstSaleDate) {
  // Look up the state rule
  const ruleData = await db.execute({
    sql: `
      SELECT * FROM state_rules
      WHERE state_code = ?
        AND (exemption_type = 'both' OR exemption_type = ?)
      LIMIT 1
    `,
    args: [stateCode, fundExemptionType]
  });

  if (ruleData.rows.length === 0) return null;
  const rule = ruleData.rows[0];
  if (!rule.filing_required) return null;

  // Check if a notice filing already exists
  const existingData = await db.execute({
    sql: `SELECT id FROM filings WHERE fund_id = ? AND state_code = ? AND filing_type = 'notice'`,
    args: [fundId, stateCode]
  });

  if (existingData.rows.length > 0) return existingData.rows[0];

  // Create new filing
  const dueDate = computeDueDate(firstSaleDate, rule.deadline_days);
  const today = new Date().toISOString().split('T')[0];
  let status = 'pending';
  if (dueDate && dueDate < today) {
    status = 'overdue';
  }

  const result = await db.execute({
    sql: `
      INSERT INTO filings (fund_id, state_code, filing_type, status, due_date)
      VALUES (?, ?, 'notice', ?, ?)
      RETURNING *;
    `,
    args: [fundId, stateCode, status, dueDate]
  });

  return result.rows[0];
}

// GET /api/investors?fund_id=X — list investors for a fund, grouped by state
router.get('/', async (req, res) => {
  try {
    const { fund_id } = req.query;
    if (!fund_id) return res.status(400).json({ error: 'fund_id query param is required' });

    const investorsData = await db.execute({
      sql: 'SELECT * FROM investors WHERE fund_id = ? ORDER BY state ASC, name ASC',
      args: [fund_id]
    });
    const investors = investorsData.rows;

    // Group by state
    const grouped = {};
    for (const inv of investors) {
      if (!grouped[inv.state]) grouped[inv.state] = [];
      grouped[inv.state].push(inv);
    }

    res.json({ investors, grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/investors — create investor + auto-trigger filing check
router.post('/', async (req, res) => {
  try {
    const {
      fund_id, name, entity_name, state, pipeline_stage,
      commitment_amount, is_accredited, is_qualified_client, notes
    } = req.body;

    if (!fund_id || !name || !state || !pipeline_stage) {
      return res.status(400).json({ error: 'fund_id, name, state, pipeline_stage are required' });
    }

    const fundData = await db.execute({ sql: 'SELECT * FROM funds WHERE id = ?', args: [fund_id] });
    if (fundData.rows.length === 0) return res.status(404).json({ error: 'Fund not found' });
    const fund = fundData.rows[0];

    const result = await db.execute({
      sql: `
        INSERT INTO investors (fund_id, name, entity_name, state, pipeline_stage,
          commitment_amount, is_accredited, is_qualified_client, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *;
      `,
      args: [
        fund_id,
        name,
        entity_name || null,
        state.toUpperCase(),
        pipeline_stage,
        commitment_amount || null,
        is_accredited !== undefined ? (is_accredited ? 1 : 0) : 1,
        is_qualified_client !== undefined ? (is_qualified_client ? 1 : 0) : 0,
        notes || null
      ]
    });

    const investor = result.rows[0];

    // Auto-filing logic: trigger if stage is committed or closed
    let filing = null;
    if (pipeline_stage === 'committed' || pipeline_stage === 'closed') {
      filing = await checkAndCreateFiling(fund_id, state.toUpperCase(), fund.exemption_type, fund.first_sale_date);
    }

    res.status(201).json({ investor, filing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/investors/:id — update investor + re-check filing obligations
router.put('/:id', async (req, res) => {
  try {
    const investorData = await db.execute({ sql: 'SELECT * FROM investors WHERE id = ?', args: [req.params.id] });
    if (investorData.rows.length === 0) return res.status(404).json({ error: 'Investor not found' });
    const investor = investorData.rows[0];

    const fundData = await db.execute({ sql: 'SELECT * FROM funds WHERE id = ?', args: [investor.fund_id] });
    const fund = fundData.rows[0];

    const {
      name, entity_name, state, pipeline_stage,
      commitment_amount, is_accredited, is_qualified_client, notes
    } = req.body;

    const newState = state ? state.toUpperCase() : investor.state;
    const newStage = pipeline_stage ?? investor.pipeline_stage;

    await db.execute({
      sql: `
        UPDATE investors SET
          name = ?,
          entity_name = ?,
          state = ?,
          pipeline_stage = ?,
          commitment_amount = ?,
          is_accredited = ?,
          is_qualified_client = ?,
          notes = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        name ?? investor.name,
        entity_name !== undefined ? entity_name : investor.entity_name,
        newState,
        newStage,
        commitment_amount !== undefined ? commitment_amount : investor.commitment_amount,
        is_accredited !== undefined ? (is_accredited ? 1 : 0) : investor.is_accredited,
        is_qualified_client !== undefined ? (is_qualified_client ? 1 : 0) : investor.is_qualified_client,
        notes !== undefined ? notes : investor.notes,
        req.params.id
      ]
    });

    const updatedData = await db.execute({ sql: 'SELECT * FROM investors WHERE id = ?', args: [req.params.id] });
    const updated = updatedData.rows[0];

    // Re-check filing obligations if state or stage changed to committed/closed
    let filing = null;
    const stageChanged = newStage !== investor.pipeline_stage;
    const stateChanged = newState !== investor.state;

    if (newStage === 'committed' || newStage === 'closed') {
      if (stageChanged || stateChanged) {
        filing = await checkAndCreateFiling(investor.fund_id, newState, fund.exemption_type, fund.first_sale_date);
      }
    }

    if (stateChanged && (newStage === 'committed' || newStage === 'closed')) {
      filing = await checkAndCreateFiling(investor.fund_id, newState, fund.exemption_type, fund.first_sale_date);
    }

    res.json({ investor: updated, filing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/investors/:id — delete investor
router.delete('/:id', async (req, res) => {
  try {
    const investorData = await db.execute({ sql: 'SELECT * FROM investors WHERE id = ?', args: [req.params.id] });
    if (investorData.rows.length === 0) return res.status(404).json({ error: 'Investor not found' });

    await db.execute({ sql: 'DELETE FROM investors WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
