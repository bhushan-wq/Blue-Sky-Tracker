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
function checkAndCreateFiling(fundId, stateCode, fundExemptionType, firstSaleDate) {
  // Look up the state rule
  const rule = db.prepare(`
    SELECT * FROM state_rules
    WHERE state_code = ?
      AND (exemption_type = 'both' OR exemption_type = ?)
    LIMIT 1
  `).get(stateCode, fundExemptionType);

  if (!rule || !rule.filing_required) return null;

  // Check if a notice filing already exists
  const existing = db.prepare(`
    SELECT id FROM filings WHERE fund_id = ? AND state_code = ? AND filing_type = 'notice'
  `).get(fundId, stateCode);

  if (existing) return existing;

  // Create new filing
  const dueDate = computeDueDate(firstSaleDate, rule.deadline_days);
  const today = new Date().toISOString().split('T')[0];
  let status = 'pending';
  if (dueDate && dueDate < today) {
    status = 'overdue';
  }

  const result = db.prepare(`
    INSERT INTO filings (fund_id, state_code, filing_type, status, due_date)
    VALUES (?, ?, 'notice', ?, ?)
  `).run(fundId, stateCode, status, dueDate);

  return db.prepare('SELECT * FROM filings WHERE id = ?').get(result.lastInsertRowid);
}

// GET /api/investors?fund_id=X — list investors for a fund, grouped by state
router.get('/', (req, res) => {
  try {
    const { fund_id } = req.query;
    if (!fund_id) return res.status(400).json({ error: 'fund_id query param is required' });

    const investors = db.prepare(`
      SELECT * FROM investors WHERE fund_id = ? ORDER BY state ASC, name ASC
    `).all(fund_id);

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
router.post('/', (req, res) => {
  try {
    const {
      fund_id, name, entity_name, state, pipeline_stage,
      commitment_amount, is_accredited, is_qualified_client, notes
    } = req.body;

    if (!fund_id || !name || !state || !pipeline_stage) {
      return res.status(400).json({ error: 'fund_id, name, state, pipeline_stage are required' });
    }

    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(fund_id);
    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const result = db.prepare(`
      INSERT INTO investors (fund_id, name, entity_name, state, pipeline_stage,
        commitment_amount, is_accredited, is_qualified_client, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fund_id,
      name,
      entity_name || null,
      state.toUpperCase(),
      pipeline_stage,
      commitment_amount || null,
      is_accredited !== undefined ? (is_accredited ? 1 : 0) : 1,
      is_qualified_client !== undefined ? (is_qualified_client ? 1 : 0) : 0,
      notes || null
    );

    const investor = db.prepare('SELECT * FROM investors WHERE id = ?').get(result.lastInsertRowid);

    // Auto-filing logic: trigger if stage is committed or closed
    let filing = null;
    if (pipeline_stage === 'committed' || pipeline_stage === 'closed') {
      filing = checkAndCreateFiling(fund_id, state.toUpperCase(), fund.exemption_type, fund.first_sale_date);
    }

    res.status(201).json({ investor, filing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/investors/:id — update investor + re-check filing obligations
router.put('/:id', (req, res) => {
  try {
    const investor = db.prepare('SELECT * FROM investors WHERE id = ?').get(req.params.id);
    if (!investor) return res.status(404).json({ error: 'Investor not found' });

    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(investor.fund_id);

    const {
      name, entity_name, state, pipeline_stage,
      commitment_amount, is_accredited, is_qualified_client, notes
    } = req.body;

    const newState = state ? state.toUpperCase() : investor.state;
    const newStage = pipeline_stage ?? investor.pipeline_stage;

    db.prepare(`
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
    `).run(
      name ?? investor.name,
      entity_name !== undefined ? entity_name : investor.entity_name,
      newState,
      newStage,
      commitment_amount !== undefined ? commitment_amount : investor.commitment_amount,
      is_accredited !== undefined ? (is_accredited ? 1 : 0) : investor.is_accredited,
      is_qualified_client !== undefined ? (is_qualified_client ? 1 : 0) : investor.is_qualified_client,
      notes !== undefined ? notes : investor.notes,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM investors WHERE id = ?').get(req.params.id);

    // Re-check filing obligations if state or stage changed to committed/closed
    let filing = null;
    const stageChanged = newStage !== investor.pipeline_stage;
    const stateChanged = newState !== investor.state;

    if (newStage === 'committed' || newStage === 'closed') {
      if (stageChanged || stateChanged) {
        filing = checkAndCreateFiling(investor.fund_id, newState, fund.exemption_type, fund.first_sale_date);
      }
    }

    // If state changed to a committed/closed investor, also check new state
    if (stateChanged && (newStage === 'committed' || newStage === 'closed')) {
      filing = checkAndCreateFiling(investor.fund_id, newState, fund.exemption_type, fund.first_sale_date);
    }

    res.json({ investor: updated, filing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/investors/:id — delete investor
router.delete('/:id', (req, res) => {
  try {
    const investor = db.prepare('SELECT * FROM investors WHERE id = ?').get(req.params.id);
    if (!investor) return res.status(404).json({ error: 'Investor not found' });

    db.prepare('DELETE FROM investors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
