const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { pool } = require('../db');

// ── Simple session store (in-memory — fine for single instance on Render) ──
const sessions = new Map();

function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Seed default admin if not present ─────────────────────────────
async function seedAdmin() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id         SERIAL PRIMARY KEY,
        username   VARCHAR(80) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const exists = await pool.query(`SELECT id FROM admins WHERE username='admin'`);
    if (exists.rows.length === 0) {
      // Default: admin / tanesco2025  (change this in production!)
      const hash = crypto.createHash('sha256').update('tanesco2025').digest('hex');
      await pool.query(`INSERT INTO admins (username, password) VALUES ('admin', $1)`, [hash]);
      console.log('✅ Default admin created: admin / tanesco2025');
    }
  } catch (e) {
    console.error('Admin seed error:', e.message);
  }
}
seedAdmin();

// ── POST /auth/login ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Username and password required.' });

  try {
    const hash   = crypto.createHash('sha256').update(password).digest('hex');
    const result = await pool.query(
      `SELECT id, username FROM admins WHERE username=$1 AND password=$2`,
      [username, hash]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid credentials. Access denied.' });

    const token = makeToken();
    sessions.set(token, { adminId: result.rows[0].id, username, loggedAt: Date.now() });

    res.cookie('session', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   req.body.remember ? 7 * 24 * 3600 * 1000 : 3600 * 1000
    });

    res.json({ success: true, redirect: '/' });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /auth/logout ───────────────────────────────────────────────
router.get('/logout', (req, res) => {
  const token = req.cookies?.session;
  if (token) sessions.delete(token);
  res.clearCookie('session');
  res.redirect('/login');
});

// ── Middleware: require login ──────────────────────────────────────
function requireAuth(req, res, next) {
  const token   = req.cookies?.session;
  const session = sessions.get(token);
  if (!session) return res.redirect('/login');
  req.admin = session;
  next();
}

module.exports = { router, requireAuth };
