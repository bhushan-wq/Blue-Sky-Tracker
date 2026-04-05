const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/state-rules — list all rules, optionally filter by exemption_type
router.get('/', (req, res) => {
  try {
    const { exemption_type } = req.query;
    let query = 'SELECT * FROM state_rules';
    const params = [];

    if (exemption_type) {
      query += " WHERE exemption_type = ? OR exemption_type = 'both'";
      params.push(exemption_type);
    }

    query += ' ORDER BY state_name ASC';
    const rules = db.prepare(query).all(...params);
    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/state-rules/:state_code — get rules for a specific state
router.get('/:state_code', (req, res) => {
  try {
    const rules = db.prepare(
      'SELECT * FROM state_rules WHERE state_code = ? ORDER BY exemption_type ASC'
    ).all(req.params.state_code.toUpperCase());

    if (!rules.length) return res.status(404).json({ error: 'State rules not found' });
    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/state-rules/:id — update a rule
router.put('/:id', (req, res) => {
  try {
    const rule = db.prepare('SELECT * FROM state_rules WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'State rule not found' });

    const {
      filing_required, form_name, filing_method, deadline_days, deadline_notes,
      fee_structure, fee_amount, fee_basis, special_requirements, last_verified, exemption_type
    } = req.body;

    db.prepare(`
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
    `).run(
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
    );

    const updated = db.prepare('SELECT * FROM state_rules WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/state-rules/bulk-update — update multiple rules
router.post('/bulk-update', (req, res) => {
  try {
    const { updates } = req.body; // array of { id, ...fields }
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates must be an array' });
    }

    const updateRule = db.prepare(`
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
    `);

    const runAll = db.transaction((items) => {
      for (const item of items) {
        const rule = db.prepare('SELECT * FROM state_rules WHERE id = ?').get(item.id);
        if (!rule) continue;
        updateRule.run(
          item.filing_required !== undefined ? (item.filing_required ? 1 : 0) : rule.filing_required,
          item.form_name !== undefined ? item.form_name : rule.form_name,
          item.filing_method !== undefined ? item.filing_method : rule.filing_method,
          item.deadline_days !== undefined ? item.deadline_days : rule.deadline_days,
          item.fee_amount !== undefined ? item.fee_amount : rule.fee_amount,
          item.special_requirements !== undefined ? item.special_requirements : rule.special_requirements,
          item.last_verified !== undefined ? item.last_verified : rule.last_verified,
          item.id
        );
      }
    });

    runAll(updates);
    res.json({ success: true, updated: updates.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
