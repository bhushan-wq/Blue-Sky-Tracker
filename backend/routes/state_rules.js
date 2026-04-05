const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/state-rules — list all rules, optionally filter by exemption_type
router.get('/', async (req, res) => {
  try {
    const { exemption_type } = req.query;
    let sql = 'SELECT * FROM state_rules';
    const args = [];

    if (exemption_type) {
      sql += " WHERE exemption_type = ? OR exemption_type = 'both'";
      args.push(exemption_type);
    }

    sql += ' ORDER BY state_name ASC';
    const rulesData = await db.execute({ sql, args });
    res.json(rulesData.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/state-rules/:state_code — get rules for a specific state
router.get('/:state_code', async (req, res) => {
  try {
    const rulesData = await db.execute({
      sql: 'SELECT * FROM state_rules WHERE state_code = ? ORDER BY exemption_type ASC',
      args: [req.params.state_code.toUpperCase()]
    });

    if (!rulesData.rows.length) return res.status(404).json({ error: 'State rules not found' });
    res.json(rulesData.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/state-rules/:id — update a rule
router.put('/:id', async (req, res) => {
  try {
    const ruleData = await db.execute({
      sql: 'SELECT * FROM state_rules WHERE id = ?',
      args: [req.params.id]
    });
    if (ruleData.rows.length === 0) return res.status(404).json({ error: 'State rule not found' });
    const rule = ruleData.rows[0];

    const {
      filing_required, form_name, filing_method, deadline_days, deadline_notes,
      fee_structure, fee_amount, fee_basis, special_requirements, last_verified, exemption_type
    } = req.body;

    await db.execute({
      sql: `
        UPDATE state_rules SET
          filing_required = ?,
          exemption_type = ?,
          form_name = ?,
          filing_method = ?,
          deadline_days = ?,
          deadline_notes = ?,
          fee_structure = ?,
          fee_amount = ?,
          fee_basis = ?,
          special_requirements = ?,
          last_verified = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        filing_required !== undefined ? (filing_required ? 1 : 0) : rule.filing_required,
        exemption_type ?? rule.exemption_type,
        form_name !== undefined ? form_name : rule.form_name,
        filing_method !== undefined ? filing_method : rule.filing_method,
        deadline_days !== undefined ? deadline_days : rule.deadline_days,
        deadline_notes !== undefined ? deadline_notes : rule.deadline_notes,
        fee_structure !== undefined ? fee_structure : rule.fee_structure,
        fee_amount !== undefined ? fee_amount : rule.fee_amount,
        fee_basis !== undefined ? fee_basis : rule.fee_basis,
        special_requirements !== undefined ? special_requirements : rule.special_requirements,
        last_verified !== undefined ? last_verified : rule.last_verified,
        req.params.id
      ]
    });

    const updatedData = await db.execute({
      sql: 'SELECT * FROM state_rules WHERE id = ?',
      args: [req.params.id]
    });
    res.json(updatedData.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/state-rules/bulk-update — update multiple rules
router.post('/bulk-update', async (req, res) => {
  try {
    const { updates } = req.body; // array of { id, ...fields }
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates must be an array' });
    }

    const tx = await db.transaction('write');
    try {
      for (const item of updates) {
        const ruleData = await tx.execute({ sql: 'SELECT * FROM state_rules WHERE id = ?', args: [item.id] });
        if (ruleData.rows.length === 0) continue;
        const rule = ruleData.rows[0];
        
        await tx.execute({
          sql: `
            UPDATE state_rules SET
              filing_required = ?,
              form_name = ?,
              filing_method = ?,
              deadline_days = ?,
              fee_amount = ?,
              special_requirements = ?,
              last_verified = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `,
          args: [
            item.filing_required !== undefined ? (item.filing_required ? 1 : 0) : rule.filing_required,
            item.form_name !== undefined ? item.form_name : rule.form_name,
            item.filing_method !== undefined ? item.filing_method : rule.filing_method,
            item.deadline_days !== undefined ? item.deadline_days : rule.deadline_days,
            item.fee_amount !== undefined ? item.fee_amount : rule.fee_amount,
            item.special_requirements !== undefined ? item.special_requirements : rule.special_requirements,
            item.last_verified !== undefined ? item.last_verified : rule.last_verified,
            item.id
          ]
        });
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    res.json({ success: true, updated: updates.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
