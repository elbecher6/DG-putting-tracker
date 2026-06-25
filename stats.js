// stats.js — stats screen

const ALL_ROUND_DISTS = [11, 22, 33, 44, 55, 66];

const Stats = (() => {

  // ── State ──
  let mode      = 'practice';   // 'round' | 'practice'
  let practUnit = 'steps';   // 'steps' | 'feet'  (practice tab only)

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  function yearStartStr() {
    return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  }

  let startDate = todayStr();
  let endDate   = todayStr();

  // ── Date helpers ──
  // Start of startDate (midnight local) → end of endDate (23:59:59.999 local)
  function withinRange(isoDate) {
    const d     = new Date(isoDate);
    const start = new Date(startDate + 'T00:00:00');
    const end   = new Date(endDate   + 'T23:59:59.999');
    return d >= start && d <= end;
  }

  // ── Data aggregation ──

  // In-round: always keyed by fixed 11ft bins
  function getRoundData() {
    const sessions = Storage.getRoundPutts();
    const byDist = {};

    sessions.forEach(session => {
      if (!withinRange(session.date)) return;
      (session.putts || []).forEach(p => {
        if (!byDist[p.dist_ft]) byDist[p.dist_ft] = { dist: p.dist_ft, made: 0, total: 0 };
        byDist[p.dist_ft].made  += p.made ? 1 : 0;
        byDist[p.dist_ft].total += 1;
      });
    });

    return ALL_ROUND_DISTS.map(d => byDist[d] || { dist: d, made: 0, total: 0 });
  }

  // Practice: keyed by raw integer distance in whichever unit is selected
  // p.dist is stored in steps; convert to feet if needed, then floor to integer bucket
  function getPracticeData() {
    const sessions = Storage.getPracticeSessions();
    const byDist = {};

    sessions.forEach(session => {
      if (!withinRange(session.date)) return;
      (session.putts || []).forEach(p => {
        const raw    = practUnit === 'steps' ? p.dist : p.dist * STEPS_TO_FEET;
        const bucket = Math.round(raw);   // integer bucket
        if (!byDist[bucket]) byDist[bucket] = { dist: bucket, made: 0, total: 0 };
        byDist[bucket].made  += p.makes;
        byDist[bucket].total += p.attempts;
      });
    });

    // Return sorted array of only buckets that have data
    return Object.values(byDist).sort((a, b) => a.dist - b.dist);
  }

  function getData() {
    return mode === 'round' ? getRoundData() : getPracticeData();
  }

  // Label for a data point's distance
  function distLabel(d) {
    if (mode === 'round') return d.dist + ' ft';
    return d.dist + (practUnit === 'steps' ? ' steps' : ' ft');
  }

  // Short label for axis ticks
  function distTick(d) {
    return mode === 'round' ? d.dist + 'ft' : d.dist + (practUnit === 'steps' ? 'st' : 'ft');
  }

  // ── SVG chart helpers ──
  const CW = 340, CH = 160;
  const PAD = { top: 20, right: 16, bottom: 32, left: 36 };

  function chartX(i, n) {
    if (n === 1) return CW / 2;
    const w = CW - PAD.left - PAD.right;
    return PAD.left + (i / (n - 1)) * w;
  }
  function chartY(pct) {
    const h = CH - PAD.top - PAD.bottom;
    return PAD.top + (1 - pct / 100) * h;
  }

  // ── Color helper ──
  function pctToColor(pct) {
    const hue = pct * 120;
    return `hsl(${hue}, 85%, 45%)`;
  }

  // ── Render ──
  function render() {
    const body = document.getElementById('stats-body');
    if (!body) return;
    const data    = getData();
    const hasData = data.some(d => d.total > 0);

    // Unit toggle only shown in practice mode
    const unitToggle = mode === 'practice' ? `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9db89d">Unit</span>
        <div class="unit-toggle" style="display:inline-flex;width:auto">
          <button id="pstat-steps-btn" class="unit-btn ${practUnit === 'steps' ? 'active' : ''}"
                  onclick="Stats.setUnit('steps')">Steps</button>
          <button id="pstat-feet-btn" class="unit-btn ${practUnit === 'feet' ? 'active' : ''}"
                  onclick="Stats.setUnit('feet')">Feet</button>
        </div>
      </div>` : '';

    body.innerHTML = `
      <div class="stats-mode-toggle">
        <button class="stats-mode-btn ${mode === 'round' ? 'active' : ''}"
                onclick="Stats.setMode('round')">In Round</button>
        <button class="stats-mode-btn ${mode === 'practice' ? 'active' : ''}"
                onclick="Stats.setMode('practice')">Practice</button>
      </div>

      ${unitToggle}

      <div class="date-range-row">
        <div class="date-field">
          <label class="date-label">From</label>
          <input type="date" class="date-input" id="stats-start"
                 value="${startDate}" max="${endDate}"
                 onchange="Stats.setDates(this.value, document.getElementById('stats-end').value)" />
        </div>
        <div class="date-range-sep">&#8594;</div>
        <div class="date-field">
          <label class="date-label">To</label>
          <input type="date" class="date-input" id="stats-end"
                 value="${endDate}" min="${startDate}" max="${todayStr()}"
                 onchange="Stats.setDates(document.getElementById('stats-start').value, this.value)" />
        </div>
        <button class="date-all-btn" onclick="Stats.setAllTime()">All</button>
      </div>

      ${!hasData
        ? `<p class="stats-empty">No ${mode === 'round' ? 'in-round' : 'practice'} data yet for this range.<br>Go sink some putts!</p>`
        : renderHeatMap(data) + renderLineChart(data) + renderTable(data)
      }
    `;
  }

  // ── Heat Map ──
  function renderHeatMap(data) {
    const MAX_R  = 110;
    const SVG_W  = 280;
    const CX     = SVG_W / 2;
    const CY     = MAX_R + 24;
    const SVG_H  = CY + MAX_R + 44;
 
    const maxDist = Math.max(...data.map(d => d.dist), 1);
 
    // Draw largest ring first so smaller ones render on top
    const rings = [...data]
      .sort((a, b) => b.dist - a.dist)
      .map(d => {
        const pct  = d.total > 0 ? d.made / d.total : null;
        const r    = (d.dist / maxDist) * MAX_R;
        const fill = pct === null ? '#2d4f2d' : pctToColor(pct);
        return `<circle cx="${CX}" cy="${CY}" r="${r}"
                        fill="${fill}" stroke="#1a2e1a" stroke-width="2"/>`;
      }).join('');
 
    // C1 = 11 steps, C2 = 22 steps — dotted reference circles
    // Only draw if they fall within the visible radius range
	// Values in whichever unit the data is currently binned in
    const c1 = mode === 'round' ? 33 : (practUnit === 'feet' ? 33 : 11);
    const c2 = mode === 'round' ? 66 : (practUnit === 'feet' ? 66 : 22);
 
    // C1/C2 dotted reference circles
    const circleLines = [
      { dist: c1, label: 'C1' },
      { dist: c2, label: 'C2' },
    ].map(({ dist, label }) => {
      const r = (dist / maxDist) * MAX_R;
      if (r < 4 || r > MAX_R + 2) return ''; // out of range, skip
      // Label at top of circle
      const lx = CX;
      const ly = CY - r - 5;
      return `
        <circle cx="${CX}" cy="${CY}" r="${r}"
                fill="none" stroke="#f0ead8" stroke-width="1.2"
                stroke-dasharray="4,4" opacity="0.5"/>
        <text x="${lx}" y="${ly}" text-anchor="middle"
              fill="#f0ead8" font-size="10" font-weight="700"
              opacity="0.7">${label}</text>`;
    }).join('');
 
    // Color scale legend bar at bottom
    const BAR_W = 120, BAR_H = 8;
    const BAR_X = (SVG_W - BAR_W) / 2;
    const BAR_Y = SVG_H - 22;
    const gradStops = [0, 25, 50, 75, 100].map(v =>
      `<stop offset="${v}%" stop-color="${pctToColor(v / 100)}"/>`
    ).join('');
 
    const legend = `
      <defs>
        <linearGradient id="acc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          ${gradStops}
        </linearGradient>
      </defs>
      <rect x="${BAR_X}" y="${BAR_Y}" width="${BAR_W}" height="${BAR_H}"
            rx="4" fill="url(#acc-grad)"/>
      <text x="${BAR_X}" y="${BAR_Y - 4}" fill="#9db89d" font-size="9">0%</text>
      <text x="${BAR_X + BAR_W}" y="${BAR_Y - 4}" text-anchor="end"
            fill="#9db89d" font-size="9">100%</text>`;
 
    return `
      <p class="section-label">Distance heat map</p>
      <div class="stats-card">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;display:block">
          ${legend}
          ${rings}
          ${circleLines}
        </svg>
      </div>`;
  }
 

  // ── Line Chart ──
  function renderLineChart(data) {
    const withData = data.filter(d => d.total > 0);
    if (withData.length < 2) return '';

    const n = data.length;

    const gridLines = [0, 25, 50, 75, 100].map(v => {
      const y = chartY(v);
      return `
        <line x1="${PAD.left}" y1="${y}" x2="${CW - PAD.right}" y2="${y}"
              stroke="#2d4f2d" stroke-width="1"/>
        <text x="${PAD.left - 4}" y="${y + 4}" text-anchor="end"
              fill="#9db89d" font-size="10">${v}%</text>`;
    }).join('');

    // For many practice distances, only label every Nth tick to avoid overlap
    const labelStep = n > 10 ? Math.ceil(n / 8) : 1;
    const xLabels = data.map((d, i) => {
      if (i % labelStep !== 0 && i !== n - 1) return '';
      return `<text x="${chartX(i, n)}" y="${CH - PAD.bottom + 14}"
                    text-anchor="middle" fill="#9db89d" font-size="9">${distTick(d)}</text>`;
    }).join('');

    const points = data.map((d, i) => {
      if (d.total === 0) return null;
      return `${chartX(i, n)},${chartY((d.made / d.total) * 100)}`;
    }).filter(Boolean);

    const polyline = points.length >= 2
      ? `<polyline points="${points.join(' ')}" fill="none" stroke="#4a8c3f"
                   stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
      : '';

    // Only show dot labels when there aren't too many points
    const showLabels = n <= 12;
    const dots = data.map((d, i) => {
      if (!d.total) return '';
      const pct = (d.made / d.total) * 100;
      const x = chartX(i, n), y = chartY(pct);
      return `<circle cx="${x}" cy="${y}" r="${n > 12 ? 3 : 5}"
                      fill="#4a8c3f" stroke="#1a2e1a" stroke-width="2"/>
              ${showLabels ? `<text x="${x}" y="${y - 10}" text-anchor="middle"
                fill="#f0ead8" font-size="10" font-weight="700">${Math.round(pct)}%</text>` : ''}`;
    }).join('');

    const areaPoints = [
      `${chartX(0, n)},${chartY(0)}`,
      ...data.map((d, i) => d.total ? `${chartX(i, n)},${chartY((d.made / d.total) * 100)}` : null).filter(Boolean),
      `${chartX(n - 1, n)},${chartY(0)}`,
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
          <line x1="${PAD.left}" y1="${chartY(0)}" x2="${CW - PAD.right}" y2="${chartY(0)}"
                stroke="#3a5c3a" stroke-width="1"/>
          ${xLabels}
          ${area}
          ${polyline}
          ${dots}
        </svg>
      </div>`;
  }

  // ── Table ──
  function renderTable(data) {
    const withData = data.filter(d => d.total > 0);
    if (withData.length === 0) return '';

    // For in-round show all fixed bins; for practice only show rows with data
    const rows = (mode === 'round' ? data : withData).map(d => {
      if (d.total === 0) return `
        <div class="stat-row stat-row-empty">
          <span class="stat-dist">${distLabel(d)}</span>
          <span class="stat-detail">—</span>
          <span class="stat-pct">—</span>
        </div>`;
      const pct   = Math.round((d.made / d.total) * 100);
      const color = pct >= 70 ? 'var(--hit)' : pct >= 40 ? 'var(--basket)' : 'var(--miss)';
      return `
        <div class="stat-row">
          <span class="stat-dist">${distLabel(d)}</span>
          <span class="stat-detail">${d.made}/${d.total}</span>
          <span class="stat-pct" style="color:${color}">${pct}%</span>
        </div>`;
    }).join('');

    const totalMade = data.reduce((s, d) => s + d.made, 0);
    const totalAtts = data.reduce((s, d) => s + d.total, 0);
    const totalPct  = totalAtts > 0 ? Math.round((totalMade / totalAtts) * 100) : 0;

    return `
      <p class="section-label" style="margin-top:24px">By distance</p>
      <div class="stats-card">
        ${rows}
        <div class="stat-row stat-total-row">
          <span class="stat-dist">Total</span>
          <span class="stat-detail">${totalMade}/${totalAtts}</span>
          <span class="stat-pct" style="color:var(--cream)">${totalPct}%</span>
        </div>
        <button onclick="Stats.exportCSV()"
                style="width:100%;margin-top:14px;padding:12px;border-radius:8px;
                       background:#2d4f2d;border:1px solid rgba(255,255,255,0.12);
                       color:#9db89d;font-size:0.85rem;font-weight:700;cursor:pointer;">
          &#8681; Export CSV
        </button>
      </div>`;
  }

  // ── Export ──
  function exportCSV() {
    const data      = getData();
    const modeName  = mode === 'round' ? 'In Round' : 'Practice';
    const unitName  = mode === 'practice' ? ` (${practUnit})` : '';
    const rows = [
      ['Putt Tracker Export'],
      ['Mode: ' + modeName],
      ['Range: ' + startDate + ' to ' + endDate],
      ['Generated: ' + new Date().toLocaleDateString()],
      [],
      ['Distance' + unitName, 'Made', 'Total', 'Percentage'],
    ];
    data.filter(d => d.total > 0).forEach(d => {
      const pct = Math.round((d.made / d.total) * 100) + '%';
      rows.push([d.dist, d.made, d.total, pct]);
    });
    const tm = data.reduce((s, d) => s + d.made, 0);
    const tt = data.reduce((s, d) => s + d.total, 0);
    rows.push([], ['Total', tm, tt, tt > 0 ? Math.round((tm / tt) * 100) + '%' : '-']);

    const csv = rows.map(r =>
      r.map(c => { const s = String(c); return s.includes(',') ? `"${s}"` : s; }).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `putts-${mode}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Public ──
  function setMode(m)  { mode = m; render(); }
  function setUnit(u)  { practUnit = u; render(); }
  function setDates(s, e) {
    if (s) startDate = s;
    if (e) endDate   = e;
    if (startDate > endDate) endDate = startDate;
    render();
  }
  function setAllTime() {
    const allDates = [
      ...Storage.getRoundPutts().map(s => s.date),
      ...Storage.getPracticeSessions().map(s => s.date),
    ];
    startDate = allDates.length > 0
	? (() => {
      const d = new Date(allDates.reduce((a, b) => a < b ? a : b));
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })()
	: yearStartStr();
    render();
  }
  function init() { render(); }

  return { init, render, setMode, setUnit, setDates, setAllTime, exportCSV };
})();