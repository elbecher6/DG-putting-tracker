// stats.js — stats screen


const ALL_ROUND_DISTS = [11, 22, 33, 44, 55, 66];

const Stats = (() => {

  // ── State ──
  let mode = 'round';          // 'round' | 'practice'
  let range = '30d';           // 'all' | '7d' | '30d' | '90d'

  const RANGES = [
    { key: '7d',  label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: '90d', label: '90 days' },
    { key: 'all', label: 'All time' },
  ];

  // ── Date helpers ──
  function cutoffDate(rangeKey) {
    if (rangeKey === 'all') return null;
    const days = parseInt(rangeKey);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  function withinRange(isoDate, cutoff) {
    if (!cutoff) return true;
    return new Date(isoDate) >= cutoff;
  }

  // ── Data aggregation ──

  // Returns [{dist_ft, made, total}] sorted by dist
  function getRoundData() {
    const sessions = Storage.getRoundPutts();
    const cutoff = cutoffDate(range);
    const byDist = {};

    sessions.forEach(session => {
      if (!withinRange(session.date, cutoff)) return;
      (session.putts || []).forEach(p => {
        if (!byDist[p.dist_ft]) byDist[p.dist_ft] = { dist_ft: p.dist_ft, made: 0, total: 0 };
        byDist[p.dist_ft].made  += p.made ? 1 : 0;
        byDist[p.dist_ft].total += 1;
      });
    });

    return ALL_ROUND_DISTS.map(d => byDist[d] || { dist_ft: d, made: 0, total: 0 });
  }

  // Returns [{dist_ft, made, total}] sorted by dist
  // Practice distances are in steps; bucket them into nearest 11ft increment
  function getPracticeData() {
    const sessions = Storage.getPracticeSessions();
    const cutoff = cutoffDate(range);
    const byDist = {};

    sessions.forEach(session => {
      if (!withinRange(session.date, cutoff)) return;
      (session.putts || []).forEach(p => {
        // Convert steps to feet, snap to nearest 11ft bucket
        const feet = p.dist * STEPS_TO_FEET;
        const bucket = snapTo11ft(feet);
        if (!byDist[bucket]) byDist[bucket] = { dist_ft: bucket, made: 0, total: 0 };
        byDist[bucket].made  += p.makes;
        byDist[bucket].total += p.attempts;
      });
    });

    return ALL_ROUND_DISTS.map(d => byDist[d] || { dist_ft: d, made: 0, total: 0 });
  }

  function snapTo11ft(feet) {
    // Snap to nearest value in [11,22,33,44,55,66]
    return ALL_ROUND_DISTS.reduce((best, d) =>
      Math.abs(d - feet) < Math.abs(best - feet) ? d : best
    );
  }

  function getData() {
    return mode === 'round' ? getRoundData() : getPracticeData();
  }

  // ── SVG chart helpers ──
  const CW = 340, CH = 160;   // chart canvas size
  const PAD = { top: 16, right: 16, bottom: 32, left: 36 };

  function chartX(i, n) {
    const w = CW - PAD.left - PAD.right;
    return PAD.left + (i / (n - 1)) * w;
  }
  function chartY(pct) {
    const h = CH - PAD.top - PAD.bottom;
    return PAD.top + (1 - pct / 100) * h;
  }

  // ── Render ──
  function render() {
    const body = document.getElementById('stats-body');
    if (!body) return;
    const data = getData();
    const hasData = data.some(d => d.total > 0);

    body.innerHTML = `
      <!-- Mode toggle -->
      <div class="stats-mode-toggle">
        <button class="stats-mode-btn ${mode === 'round' ? 'active' : ''}"
                onclick="Stats.setMode('round')">In Round</button>
        <button class="stats-mode-btn ${mode === 'practice' ? 'active' : ''}"
                onclick="Stats.setMode('practice')">Practice</button>
      </div>

      <!-- Date range pills -->
      <div class="pill-group" style="margin-bottom:24px">
        ${RANGES.map(r => `
          <button class="pill ${range === r.key ? 'selected' : ''}"
                  onclick="Stats.setRange('${r.key}')">${r.label}</button>
        `).join('')}
      </div>

      ${!hasData ? renderEmpty() : `
        ${renderHeatMap(data)}
        ${renderLineChart(data)}
        ${renderTable(data)}
      `}
    `;
  }

  function renderEmpty() {
    return `<p class="stats-empty">No ${mode === 'round' ? 'in-round' : 'practice'} data yet for this time range.<br>Go sink some putts!</p>`;
  }

  // ── Heat Map ──
function renderHeatMap(data) {
  const SVG_W = 340;
  const SVG_H = 300;

  const CX = SVG_W / 2;
  const CY = SVG_H / 2 + 10;

  const MAX_R = 120;

  // Draw largest ring first so smaller rings appear on top
  const rings = [...data]
    .sort((a, b) => b.dist_ft - a.dist_ft)
    .map(d => {
      const pct = d.total > 0 ? d.made / d.total : null;

      const r = (d.dist_ft / 66) * MAX_R;

      const fill = pct === null
        ? '#444444'
        : pctToColor(pct);

      return `
        <circle
          cx="${CX}"
          cy="${CY}"
          r="${r}"
          fill="${fill}"
          stroke="#1a2e1a"
          stroke-width="2"
        />
      `;
    })
    .join('');

  // Distance labels
  const labels = data.map(d => {
    const pct = d.total > 0
      ? `${Math.round((d.made / d.total) * 100)}%`
      : '--';

    const r = (d.dist_ft / 66) * MAX_R;

    return `
      <g>
        

        <text
          x="${CX + r}"
          y="${CY + 4}"
          fill="#f0ead8"
          font-size="10"
          font-weight="600">
          ${d.dist_ft}ft
        </text>
      </g>
    `;
  }).join('');

  return `
    <p class="section-label">Distance heat map</p>

    <div class="stats-card">
      <svg
        viewBox="0 0 ${SVG_W} ${SVG_H}"
        xmlns="http://www.w3.org/2000/svg"
        style="width:100%;display:block">

        ${rings}

        

        

        ${labels}

      </svg>
    </div>
  `;
}

function pctToColor(pct) {
  const hue = pct * 120;
  return `hsl(${hue}, 85%, 45%)`;
}

  // ── Line Chart ──
  function renderLineChart(data) {
    const withData = data.filter(d => d.total > 0);
    if (withData.length < 2) return '';

    // Grid lines at 0, 25, 50, 75, 100%
    const gridLines = [0, 25, 50, 75, 100].map(v => {
      const y = chartY(v);
      return `
        <line x1="${PAD.left}" y1="${y}" x2="${CW - PAD.right}" y2="${y}"
              stroke="#2d4f2d" stroke-width="1"/>
        <text x="${PAD.left - 4}" y="${y + 4}" text-anchor="end"
              fill="#9db89d" font-size="10">${v}%</text>
      `;
    }).join('');

    // X axis labels
    const xLabels = data.map((d, i) => `
      <text x="${chartX(i, data.length)}" y="${CH - PAD.bottom + 14}"
            text-anchor="middle" fill="#9db89d" font-size="10">${d.dist_ft}ft</text>
    `).join('');

    // Build polyline only through points with data
    const points = data.map((d, i) => {
      if (d.total === 0) return null;
      const pct = (d.made / d.total) * 100;
      return `${chartX(i, data.length)},${chartY(pct)}`;
    }).filter(Boolean);

    const polyline = points.length >= 2
      ? `<polyline points="${points.join(' ')}"
           fill="none" stroke="#4a8c3f" stroke-width="2.5"
           stroke-linejoin="round" stroke-linecap="round"/>`
      : '';

    // Dots
    const dots = data.map((d, i) => {
      if (d.total === 0) return '';
      const pct = (d.made / d.total) * 100;
      const x = chartX(i, data.length);
      const y = chartY(pct);
      return `
        <circle cx="${x}" cy="${y}" r="5" fill="#4a8c3f" stroke="#1a2e1a" stroke-width="2"/>
        <text x="${x}" y="${y - 10}" text-anchor="middle"
              fill="#f0ead8" font-size="10" font-weight="700">${Math.round(pct)}%</text>
      `;
    }).join('');

    // Area fill under line
    const areaPoints = [
      `${chartX(0, data.length)},${chartY(0)}`,
      ...data.map((d, i) => {
        if (d.total === 0) return null;
        const pct = (d.made / d.total) * 100;
        return `${chartX(i, data.length)},${chartY(pct)}`;
      }).filter(Boolean),
      `${chartX(data.length - 1, data.length)},${chartY(0)}`,
    ];

    const area = points.length >= 2
      ? `<polygon points="${areaPoints.join(' ')}" fill="#2d5a28" opacity="0.4"/>`
      : '';

    return `
      <p class="section-label" style="margin-top:24px">Accuracy by distance</p>
      <div class="stats-card">
        <svg viewBox="0 0 ${CW} ${CH}" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;display:block">
          ${gridLines}
          <!-- X axis -->
          <line x1="${PAD.left}" y1="${chartY(0)}" x2="${CW - PAD.right}" y2="${chartY(0)}"
                stroke="#3a5c3a" stroke-width="1"/>
          ${xLabels}
          ${area}
          ${polyline}
          ${dots}
        </svg>
      </div>
    `;
  }

  // ── Table ──
  function renderTable(data) {
    const withData = data.filter(d => d.total > 0);
    if (withData.length === 0) return '';

    const rows = data.map(d => {
      if (d.total === 0) return `
        <div class="stat-row stat-row-empty">
          <span class="stat-dist">${d.dist_ft} ft</span>
          <span class="stat-detail">—</span>
          <span class="stat-pct">—</span>
        </div>
      `;
      const pct = Math.round((d.made / d.total) * 100);
      const color = pct >= 70 ? 'var(--hit)' : pct >= 40 ? 'var(--basket)' : 'var(--miss)';
      return `
        <div class="stat-row">
          <span class="stat-dist">${d.dist_ft} ft</span>
          <span class="stat-detail">${d.made}/${d.total}</span>
          <span class="stat-pct" style="color:${color}">${pct}%</span>
        </div>
      `;
    }).join('');

    // Totals row
    const totalMade  = data.reduce((s, d) => s + d.made, 0);
    const totalAtts  = data.reduce((s, d) => s + d.total, 0);
    const totalPct   = totalAtts > 0 ? Math.round((totalMade / totalAtts) * 100) : 0;

    return `
      <p class="section-label" style="margin-top:24px">By distance</p>
      <div class="stats-card">
        ${rows}
        <div class="stat-row stat-total-row">
          <span class="stat-dist">Total</span>
          <span class="stat-detail">${totalMade}/${totalAtts}</span>
          <span class="stat-pct" style="color:var(--cream)">${totalPct}%</span>
        </div>
		
        <button onclick="Stats.exportCSV()" style="width:100%;margin-top:14px;padding:12px;border-radius:8px;background:#2d4f2d;border:1px solid rgba(255,255,255,0.12);color:#9db89d;font-size:0.85rem;font-weight:700;cursor:pointer;">&#8681; Export CSV</button>
      </div>
    `;
  }
  
  // Export table as .csv
  function exportCSV() {
  var data = getData();
  var modeName = mode === 'round' ? 'In Round' : 'Practice';
  var rangeLabel = RANGES.find(function(r){ return r.key === range; }).label;

  var rows = [
    ['Putt Tracker Export'],
    ['Mode: ' + modeName],
    ['Range: ' + rangeLabel],
    ['Generated: ' + new Date().toLocaleDateString()],
    [],
    ['Distance (ft)', 'Made', 'Total', 'Percentage']
  ];

  data.forEach(function(d) {
    var pct = d.total > 0 ? Math.round((d.made / d.total) * 100) + '%' : '-';
    rows.push([d.dist_ft, d.made, d.total, pct]);
  });

  var tm = data.reduce(function(s,d){ return s + d.made; }, 0);
  var tt = data.reduce(function(s,d){ return s + d.total; }, 0);
  rows.push([]);
  rows.push(['Total', tm, tt, tt > 0 ? Math.round((tm/tt)*100) + '%' : '-']);

  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      var s = String(cell);
      return s.includes(',') ? '"' + s + '"' : s;
    }).join(',');
  }).join('\n');

  var blob = new Blob([csv], { type: 'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'putts-' + mode + '-' + range + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

  // ── Public setters ──
  function setMode(m) { mode = m; render(); }
  function setRange(r) { range = r; render(); }
  function init() { render(); }

  return { init, render, setMode, setRange, exportCSV };
})();