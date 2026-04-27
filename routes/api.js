const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ── Tilt thresholds ──────────────────────────────────────────────
const THRESHOLD_WARNING  = 10;   // degrees — warning
const THRESHOLD_CRITICAL = 20;   // degrees — critical / dispatch crew

function getAlertLevel(tilt) {
  const abs = Math.abs(tilt);
  if (abs >= THRESHOLD_CRITICAL) return 'critical';
  if (abs >= THRESHOLD_WARNING)  return 'warning';
  return 'normal';
}

// ── GET /api/reading?node=A&tilt=12.5 ───────────────────────────
// ESP32 calls this URL — no body needed, just query params
router.get('/reading', async (req, res) => {
  const { node, tilt } = req.query;

  if (!node || tilt === undefined) {
    return res.status(400).json({ error: 'Missing node or tilt parameter' });
  }

  const tiltVal    = parseFloat(tilt);
  const alertLevel = getAlertLevel(tiltVal);
  const isAlert    = alertLevel !== 'normal';

  try {
    // 1. Save reading
    await pool.query(
      `INSERT INTO pole_readings (node_id, tilt_angle, alert, alert_level)
       VALUES ($1, $2, $3, $4)`,
      [node, tiltVal, isAlert, alertLevel]
    );

    // 2. If alert — log to alerts table
    if (isAlert) {
      const msg = alertLevel === 'critical'
        ? `CRITICAL: Pole ${node} tilted ${tiltVal}° — dispatch crew immediately!`
        : `WARNING: Pole ${node} tilted ${tiltVal}° — inspection needed.`;

      await pool.query(
        `INSERT INTO alerts (node_id, tilt_angle, alert_level, message)
         VALUES ($1, $2, $3, $4)`,
        [node, tiltVal, alertLevel, msg]
      );
    }

    // 3. Respond to ESP32 — keep it short
    res.json({
      status:  'ok',
      node,
      tilt:    tiltVal,
      alert:   alertLevel
    });

  } catch (err) {
    console.error('DB error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/readings?node=A&limit=50 ───────────────────────────
router.get('/readings', async (req, res) => {
  const { node, limit = 100 } = req.query;
  try {
    const sql = node
      ? `SELECT * FROM pole_readings WHERE node_id=$1 ORDER BY created_at DESC LIMIT $2`
      : `SELECT * FROM pole_readings ORDER BY created_at DESC LIMIT $1`;
    const params = node ? [node, parseInt(limit)] : [parseInt(limit)];
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/alerts?resolved=false ──────────────────────────────
router.get('/alerts', async (req, res) => {
  const { resolved } = req.query;
  try {
    let sql    = `SELECT * FROM alerts ORDER BY created_at DESC LIMIT 200`;
    let params = [];
    if (resolved !== undefined) {
      sql    = `SELECT * FROM alerts WHERE resolved=$1 ORDER BY created_at DESC LIMIT 200`;
      params = [resolved === 'true'];
    }
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/alerts/:id/resolve ───────────────────────────────
router.patch('/alerts/:id/resolve', async (req, res) => {
  try {
    await pool.query(`UPDATE alerts SET resolved=true WHERE id=$1`, [req.params.id]);
    res.json({ status: 'resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stats ───────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [nodes, total, activeAlerts, latest] = await Promise.all([
      pool.query(`SELECT DISTINCT node_id FROM pole_readings`),
      pool.query(`SELECT COUNT(*) FROM pole_readings`),
      pool.query(`SELECT COUNT(*) FROM alerts WHERE resolved=false`),
      pool.query(`
        SELECT DISTINCT ON (node_id)
          node_id, tilt_angle, alert_level, created_at
        FROM pole_readings
        ORDER BY node_id, created_at DESC
      `)
    ]);
    res.json({
      nodes:         nodes.rows.map(r => r.node_id),
      total_readings: parseInt(total.rows[0].count),
      active_alerts: parseInt(activeAlerts.rows[0].count),
      latest_per_node: latest.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
