// more.js — fun stats screen
// Combines In Round + Practice data into a few "fun" aggregate stats.
// C1 = putts at/inside 33ft (circle 1), C2 = putts 34-66ft (circle 2), Total = everything.

const More = (() => {

  let scope = 'total';   // 'total' | 'c1' | 'c2'
  let source = 'all';    // 'all' | 'practice' | 'round'

  const C1_MAX_FT = 33; // putts at or inside this distance count as C1
  const C2_MAX_FT = 66; // putts beyond C1 and up to this distance count as C2

  // ── Helpers: normalize every putt (round + practice) into a common shape ──
  // { dist_ft, made, dateStr (YYYY-MM-DD), monthKey (YYYY-MM), source ('round'|'practice') }
  function allPuttsNormalized() {
    const out = [];

    // In Round putts are already stored individually with dist_ft + made
    Storage.getRoundPutts().forEach(session => {
      const day = (session.date || '').slice(0, 10);
      const month = day.slice(0, 7);
      (session.putts || []).forEach(p => {
        out.push({ dist_ft: p.dist_ft, made: !!p.made, dateStr: day, monthKey: month, source: 'round' });
      });
    });

    // Practice sessions store sets, not individual putts — expand makes/misses
    // dist is stored in steps; convert to feet for distance-based stats
    Storage.getPracticeSessions().forEach(session => {
      const day = (session.date || '').slice(0, 10);
      const month = day.slice(0, 7);
      const stepsToFeet = (typeof STEPS_TO_FEET !== 'undefined') ? STEPS_TO_FEET : 3;
      (session.putts || []).forEach(p => {
        const distFt = Math.round(p.dist * stepsToFeet);
        const made = p.makes || 0;
        const total = p.attempts || 0;
        for (let i = 0; i < total; i++) {
          out.push({ dist_ft: distFt, made: i < made, dateStr: day, monthKey: month, source: 'practice' });
        }
      });
    });

    return out;
  }

  // Filter putts to the current source (All / Practice / In Round)
  function sourcedPutts(putts) {
    if (source === 'practice') return putts.filter(p => p.source === 'practice');
    if (source === 'round') return putts.filter(p => p.source === 'round');
    return putts; // all
  }

  function sourceLabel() {
    if (source === 'practice') return 'Practice';
    if (source === 'round') return 'In Round';
    return 'All Putts';
  }

  // Filter putts to the current scope (C1 / C2 / Total)
  function scopedPutts(putts) {
    if (scope === 'c1') return putts.filter(p => p.dist_ft <= C1_MAX_FT);
    if (scope === 'c2') return putts.filter(p => p.dist_ft > C1_MAX_FT && p.dist_ft <= C2_MAX_FT);
    return putts; // total
  }

  function scopeLabel() {
    if (scope === 'c1') return 'Circle 1 (0–33ft)';
    if (scope === 'c2') return 'Circle 2 (34–66ft)';
    return 'All Distances';
  }

  // ── Stat 1: total distance attempted vs made, in feet ──
  function distanceStats(putts) {
    let attemptedFt = 0, madeFt = 0;
    putts.forEach(p => {
      attemptedFt += p.dist_ft;
      if (p.made) madeFt += p.dist_ft;
    });
    return { attemptedFt, madeFt };
  }

  // ── Stat 2: putting percentage by month ──
  function monthlyPct(putts) {
    const byMonth = {};
    putts.forEach(p => {
      if (!p.monthKey) return;
      if (!byMonth[p.monthKey]) byMonth[p.monthKey] = { made: 0, total: 0 };
      byMonth[p.monthKey].total += 1;
      byMonth[p.monthKey].made += p.made ? 1 : 0;
    });
    return Object.keys(byMonth).sort().map(key => ({
      month: key,
      made: byMonth[key].made,
      total: byMonth[key].total,
      pct: byMonth[key].total > 0 ? Math.round((byMonth[key].made / byMonth[key].total) * 100) : 0,
    }));
  }

  function monthLabel(key) {
    const [y, m] = key.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }

  // ── Stat 3: overall percentage ──
  function overallPct(putts) {
    const made = putts.filter(p => p.made).length;
    const total = putts.length;
    return { made, total, pct: total > 0 ? Math.round((made / total) * 100) : null };
  }

  // ── Number formatting ──
  function formatFt(n) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ft';
  }
  function formatMiles(n) {
    return (n / 5280).toFixed(2) + ' mi';
  }

  // ── Render ──
  function render() {
    const body = document.getElementById('more-body');
    if (!body) return;

    const all = allPuttsNormalized();
    const putts = scopedPutts(sourcedPutts(all));

    if (putts.length === 0) {
      body.innerHTML = sourceToggle() + scopeToggle() + `
        <p class="stats-empty">No putts logged yet for ${sourceLabel()} &middot; ${scopeLabel()}.<br>Go log some practice or rounds!</p>`;
      return;
    }

    const { attemptedFt, madeFt } = distanceStats(putts);
    const months = monthlyPct(putts);
    const overall = overallPct(putts);

    body.innerHTML =
      sourceToggle() +
      scopeToggle() +
      renderOverallCard(overall) +
      renderDistanceCard(attemptedFt, madeFt) +
      renderMonthlyChart(months);
  }

  function sourceToggle() {
    return `
      <div class="stats-mode-toggle" style="margin-bottom:10px">
        <button class="stats-mode-btn ${source === 'all' ? 'active' : ''}"
                onclick="More.setSource('all')">All</button>
        <button class="stats-mode-btn ${source === 'practice' ? 'active' : ''}"
                onclick="More.setSource('practice')">Practice</button>
        <button class="stats-mode-btn ${source === 'round' ? 'active' : ''}"
                onclick="More.setSource('round')">In Round</button>
      </div>`;
  }

  function scopeToggle() {
    return `
      <div class="stats-mode-toggle" style="margin-bottom:20px">
        <button class="stats-mode-btn ${scope === 'total' ? 'active' : ''}"
                onclick="More.setScope('total')">Total</button>
        <button class="stats-mode-btn ${scope === 'c1' ? 'active' : ''}"
                onclick="More.setScope('c1')">C1</button>
        <button class="stats-mode-btn ${scope === 'c2' ? 'active' : ''}"
                onclick="More.setScope('c2')">C2</button>
      </div>`;
  }

  // ── Card: overall percentage ──
  function renderOverallCard(overall) {
    const pctColor = overall.pct === null ? 'var(--text-dim)'
      : overall.pct >= 70 ? 'var(--hit)' : overall.pct >= 40 ? 'var(--basket)' : 'var(--miss)';
    return `
      <p class="section-label">Overall putting percentage</p>
      <div class="stats-card" style="text-align:center;padding:24px">
        <div style="font-size:2.6rem;font-weight:900;color:${pctColor};letter-spacing:-0.02em">
          ${overall.pct !== null ? overall.pct + '%' : '—'}
        </div>
        <div style="font-size:0.85rem;color:var(--text-dim);margin-top:4px">
          ${overall.made} made of ${overall.total} attempts &middot; ${sourceLabel()} &middot; ${scopeLabel()}
        </div>
      </div>`;
  }

  // ── Card: total distance attempted/made ──
  function renderDistanceCard(attemptedFt, madeFt) {
    return `
      <p class="section-label" style="margin-top:24px">Total putt distance</p>
      <div class="stats-card">
        <div class="stat-row">
          <span class="stat-dist">Attempted</span>
          <span class="stat-detail">${formatMiles(attemptedFt)}</span>
          <span class="stat-pct" style="color:var(--cream)">${formatFt(attemptedFt)}</span>
        </div>
        <div class="stat-row" style="border-bottom:none">
          <span class="stat-dist">Made</span>
          <span class="stat-detail">${formatMiles(madeFt)}</span>
          <span class="stat-pct" style="color:var(--hit)">${formatFt(madeFt)}</span>
        </div>
      </div>`;
  }

  // ── Chart: monthly percentage trend ──
  function renderMonthlyChart(months) {
    if (months.length < 2) {
      // Not enough months for a trend line — show a simple message instead
      return `
        <p class="section-label" style="margin-top:24px">Percentage over time</p>
        <div class="stats-card">
          <p style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:12px 0">
            Need at least two months of data to show a trend.
          </p>
        </div>`;
    }

    const CW = 320, CH = 170, PT = 20, PR = 14, PB = 30, PL = 36;
    const n = months.length;

    function cx(i) { return n === 1 ? CW / 2 : PL + (i / (n - 1)) * (CW - PL - PR); }
    function cy(pct) { return PT + (1 - pct / 100) * (CH - PT - PB); }

    const grid = [0, 25, 50, 75, 100].map(v => `
      <line x1="${PL}" y1="${cy(v)}" x2="${CW - PR}" y2="${cy(v)}" stroke="#2d4f2d" stroke-width="1"/>
      <text x="${PL - 4}" y="${cy(v) + 4}" text-anchor="end" fill="#9db89d" font-size="10">${v}%</text>
    `).join('');

    const labelStep = n > 8 ? Math.ceil(n / 6) : 1;
    const xLabels = months.map((m, i) => {
      if (i % labelStep !== 0 && i !== n - 1) return '';
      return `<text x="${cx(i)}" y="${CH - PB + 14}" text-anchor="middle"
                    fill="#9db89d" font-size="9">${monthLabel(m.month)}</text>`;
    }).join('');

    const points = months.map((m, i) => `${cx(i)},${cy(m.pct)}`);
    const polyline = `<polyline points="${points.join(' ')}" fill="none" stroke="#4a8c3f"
                                stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

    const showLabels = n <= 10;
    const dots = months.map((m, i) => {
      const x = cx(i), y = cy(m.pct);
      return `<circle cx="${x}" cy="${y}" r="${n > 10 ? 3 : 5}" fill="#4a8c3f" stroke="#1a2e1a" stroke-width="2"/>
              ${showLabels ? `<text x="${x}" y="${y - 10}" text-anchor="middle"
                fill="#f0ead8" font-size="10" font-weight="700">${m.pct}%</text>` : ''}`;
    }).join('');

    const areaPoints = [`${cx(0)},${cy(0)}`, ...points, `${cx(n - 1)},${cy(0)}`];
    const area = `<polygon points="${areaPoints.join(' ')}" fill="#2d5a28" opacity="0.4"/>`;

    return `
      <p class="section-label" style="margin-top:24px">Percentage over time</p>
      <div class="stats-card">
        <svg viewBox="0 0 ${CW} ${CH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
          ${grid}
          <line x1="${PL}" y1="${cy(0)}" x2="${CW - PR}" y2="${cy(0)}" stroke="#3a5c3a" stroke-width="1"/>
          ${xLabels}
          ${area}
          ${polyline}
          ${dots}
        </svg>
      </div>`;
  }

  // ── Public ──
  function setScope(s) { scope = s; render(); }
  function setSource(s) { source = s; render(); }
  function init() { render(); }

  return { init, render, setScope, setSource };
})();