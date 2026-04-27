const REFRESH_MS = 8000;   // auto-refresh every 8 s
let knownNodes   = new Set();

// ── Helpers ───────────────────────────────────────────────────────
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { hour12: false });
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function levelClass(level) {
  if (level === 'critical') return 'critical';
  if (level === 'warning')  return 'warning';
  return 'normal';
}

// ── Stats ─────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const r   = await fetch('/api/stats');
    const d   = await r.json();
    const lc  = levelClass;

    document.getElementById('stat-nodes').textContent  = d.nodes.length;
    document.getElementById('stat-total').textContent  = d.total_readings.toLocaleString();
    document.getElementById('stat-alerts').textContent = d.active_alerts;
    document.getElementById('stat-time').textContent   = new Date().toLocaleTimeString('en-GB');

    // Populate node filter select
    const sel = document.getElementById('node-filter');
    d.nodes.forEach(n => {
      if (!knownNodes.has(n)) {
        knownNodes.add(n);
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = 'Pole ' + n;
        sel.appendChild(opt);
      }
    });

    // Render pole cards
    const grid = document.getElementById('poles-grid');
    if (d.latest_per_node.length === 0) {
      grid.innerHTML = '<p class="empty-msg">No pole data received yet.</p>';
      return;
    }
    grid.innerHTML = d.latest_per_node.map(p => {
      const lvl   = levelClass(p.alert_level);
      const tilt  = parseFloat(p.tilt_angle);
      const pct   = clamp(Math.abs(tilt) / 45 * 100, 2, 100).toFixed(1);
      return `
        <div class="pole-card ${lvl}">
          <div class="pole-name">Pole ${p.node_id}</div>
          <div class="tilt-value">${tilt.toFixed(1)}°</div>
          <div class="pole-meta">Last update: ${fmtTime(p.created_at)}</div>
          <span class="pole-badge badge-${lvl}">${lvl}</span>
          <div class="tilt-bar-wrap">
            <div class="tilt-bar-track">
              <div class="tilt-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('Stats error:', e);
  }
}

// ── Alerts ────────────────────────────────────────────────────────
async function loadAlerts() {
  const showResolved = document.getElementById('show-resolved').checked;
  try {
    const url = showResolved ? '/api/alerts' : '/api/alerts?resolved=false';
    const r   = await fetch(url);
    const rows = await r.json();
    const tb  = document.getElementById('alerts-body');

    if (rows.length === 0) {
      tb.innerHTML = '<tr><td colspan="6" class="empty-msg">No alerts found.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map(a => {
      const lvl = levelClass(a.alert_level);
      return `
        <tr>
          <td>${fmtTime(a.created_at)}</td>
          <td>${a.node_id}</td>
          <td>${parseFloat(a.tilt_angle).toFixed(1)}</td>
          <td><span class="badge ${lvl}">${lvl}</span></td>
          <td>${a.message || '—'}</td>
          <td>${a.resolved
            ? '<span style="color:var(--green);font-size:12px;">✓ Resolved</span>'
            : `<button class="resolve-btn" onclick="resolveAlert(${a.id})">Resolve</button>`
          }</td>
        </tr>`;
    }).join('');
  } catch (e) {
    console.error('Alerts error:', e);
  }
}

// ── Readings ──────────────────────────────────────────────────────
async function loadReadings() {
  const node = document.getElementById('node-filter').value;
  const url  = node ? `/api/readings?node=${node}&limit=50` : '/api/readings?limit=50';
  try {
    const r    = await fetch(url);
    const rows = await r.json();
    const tb   = document.getElementById('readings-body');

    if (rows.length === 0) {
      tb.innerHTML = '<tr><td colspan="4" class="empty-msg">No readings found.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map(row => {
      const lvl = levelClass(row.alert_level);
      return `
        <tr>
          <td>${fmtTime(row.created_at)}</td>
          <td>${row.node_id}</td>
          <td>${parseFloat(row.tilt_angle).toFixed(2)}</td>
          <td><span class="badge ${lvl}">${row.alert_level}</span></td>
        </tr>`;
    }).join('');
  } catch (e) {
    console.error('Readings error:', e);
  }
}

// ── Resolve alert ─────────────────────────────────────────────────
async function resolveAlert(id) {
  try {
    await fetch(`/api/alerts/${id}/resolve`, { method: 'PATCH' });
    loadAlerts();
    loadStats();
  } catch (e) {
    console.error('Resolve error:', e);
  }
}

// ── Bind events & boot ────────────────────────────────────────────
document.getElementById('show-resolved').addEventListener('change', loadAlerts);
document.getElementById('node-filter').addEventListener('change', loadReadings);

async function refreshAll() {
  await Promise.all([loadStats(), loadAlerts(), loadReadings()]);
}

refreshAll();
setInterval(refreshAll, REFRESH_MS);
