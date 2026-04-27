require('dotenv').config();
const express    = require('express');
const path       = require('path');
const cookieParser = require('cookie-parser');
const { initDB } = require('./db');
const { router: authRouter, requireAuth } = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Auth routes (public) ──────────────────────────────────────────
app.use('/auth', authRouter);
app.get('/login', (req, res) => res.render('login'));

// ── Protected routes ──────────────────────────────────────────────
app.use('/api', require('./routes/api'));          // ESP32 — no auth (device key optional later)
app.get('/', requireAuth, (req, res) => res.render('dashboard', { admin: req.admin }));

// Health check — Render pings this
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Start ─────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 TANESCO Monitor running on port ${PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to init DB:', err.message);
  process.exit(1);
});
