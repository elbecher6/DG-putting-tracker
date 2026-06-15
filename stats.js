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
    const maxTotal = Math.max(...data.map(d => d.total), 1);
    const CIRCLE_R = 22;
    const GAP = 14;
    const SVG_W = 340;
    const ROW_H = CIRCLE_R * 2 + GAP;
    const SVG_H = data.length * ROW_H + 24;
    const LABEL_W = 44;
    const CX = LABEL_W + CIRCLE_R + 8;

    const rows = data.map((d, i) => {
      const cy = 12 + i * ROW_H + CIRCLE_R;
      const pct = d.total > 0 ? d.made / d.total : null;
      const volOpacity = d.total > 0 ? 0.15 + 0.85 * (d.total / maxTotal) : 0.04;

      const accColor  = pct === null ? '#2d4f2d' : pctToColor(pct);
      // Use hex-with-opacity trick: pre-bake gold at various opacities
      const volAlpha  = Math.round(volOpacity * 255).toString(16).padStart(2, '0');
      const volColor  = `#c8a84b${volAlpha}`;

      // Semicircle: draw from top-center, arc to bottom-center
      // Left = counterclockwise (sweep-flag 0), Right = clockwise (sweep-flag 1)
      const tx = CX, ty1 = cy - CIRCLE_R, ty2 = cy + CIRCLE_R;
      const leftPath  = `M ${tx} ${ty1} A ${CIRCLE_R} ${CIRCLE_R} 0 0 0 ${tx} ${ty2} Z`;
      const rightPath = `M ${tx} ${ty1} A ${CIRCLE_R} ${CIRCLE_R} 0 0 1 ${tx} ${ty2} Z`;

      const pctLabel = pct !== null ? `${Math.round(pct * 100)}%` : '-';
      const volLabel = `${d.total}`;

      return `<g>
          <text x="${LABEL_W - 4}" y="${cy + 5}" text-anchor="end"
                fill="#9db89d" font-size="12" font-weight="600">${d.dist_ft}ft</text>
          <circle cx="${CX}" cy="${cy}" r="${CIRCLE_R}" fill="#1e3a1e" stroke="#3a5c3a" stroke-width="1"/>
          <path d="${leftPath}" fill="${accColor}"/>
          <path d="${rightPath}" fill="${volColor}"/>
          <line x1="${CX}" y1="${cy - CIRCLE_R}" x2="${CX}" y2="${cy + CIRCLE_R}"
                stroke="#1a2e1a" stroke-width="1.5"/>
          <text x="${CX - CIRCLE_R / 2 - 1}" y="${cy + 5}" text-anchor="middle"
                fill="white" font-size="10" font-weight="700">${pctLabel}</text>
          <text x="${CX + CIRCLE_R / 2 + 1}" y="${cy + 5}" text-anchor="middle"
                fill="white" font-size="10" font-weight="700">${volLabel}</text>
        </g>`;
    }).join('');

    const legendY = SVG_H - 4;

    return `
      <p class="section-label">Distance heat map</p>
      <div class="stats-card">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;display:block;overflow:visible">
          ${rows}
          <!-- Legend -->
          <text x="${CX - CIRCLE_R}" y="${legendY}" text-anchor="middle"
                fill="#9db89d" font-size="10">accuracy</text>
          <text x="${CX + CIRCLE_R}" y="${legendY}" text-anchor="middle"
                fill="#9db89d" font-size="10">attempts</text>
        </svg>
      </div>
    `;
  }

  function pctToColor(pct) {
    // 0 → red, 0.5 → yellow, 1 → green
    let r, g, b = 0;
    if (pct < 0.5) {
      r = 200; g = Math.round(pct * 2 * 174);
    } else {
      r = Math.round((1 - pct) * 2 * 200); g = 174;
    }
    return `rgb(${r},${g},${b})`;
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
      </div>
    `;
  }

  // ── Public setters ──
  function setMode(m) { mode = m; render(); }
  function setRange(r) { range = r; render(); }
  function init() { render(); }

  return { init, render, setMode, setRange };
})();