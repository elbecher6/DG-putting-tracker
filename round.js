// round.js — in-round putting tracker

// Distances: 11ft increments from 11 to 66ft
const ROUND_DISTANCES_FT = [11, 22, 33, 44, 55, 66];

const Round = (() => {
  let state = {
    active: false,
    putts: [],           // [{dist_ft, made, timestamp}]
    selectedDist: null,
  };

  // Persist the in-progress round so a reload can recover it
  function persist() {
    if (!state.active) return;
    Storage.setActiveRound({
      putts: state.putts,
      selectedDist: state.selectedDist,
    });
  }

  // ── Render main round screen ──
  function render() {
    const body = document.getElementById('round-body');

    const log = state.putts;
    const totalMade  = log.filter(p => p.made).length;
    const totalMiss  = log.filter(p => !p.made).length;
    const total      = log.length;
    const pct        = total > 0 ? Math.round((totalMade / total) * 100) : null;

    body.innerHTML = `
      <!-- Live counters -->
      <div class="round-counters">
        <div class="round-counter">
          <span class="round-counter-num" id="rc-made">${totalMade}</span>
          <span class="round-counter-label">Made</span>
        </div>
        <div class="round-counter round-counter-pct">
          <span class="round-counter-num">${pct !== null ? pct + '%' : '—'}</span>
          <span class="round-counter-label">${total} putts</span>
        </div>
        <div class="round-counter">
          <span class="round-counter-num" id="rc-miss">${totalMiss}</span>
          <span class="round-counter-label">Missed</span>
        </div>
      </div>

      <!-- Distance selector -->
      <p class="section-label">Select distance</p>
      <div class="dist-grid" id="dist-grid">
        ${ROUND_DISTANCES_FT.map(d => `
          <button class="dist-tile ${state.selectedDist === d ? 'selected' : ''}"
                  onclick="Round.selectDist(${d})">
            <span class="dist-tile-num">${d-11} - ${d}</span>
            <span class="dist-tile-unit">ft</span>
          </button>
        `).join('')}
      </div>

      <!-- Make / Miss buttons -->
      <div class="outcome-row">
        <button class="outcome-btn outcome-miss ${state.selectedDist === null ? 'disabled' : ''}"
                onclick="Round.logPutt(false)" ${state.selectedDist === null ? 'disabled' : ''}>
          <span class="outcome-icon">✕</span>
          Miss
        </button>
        <button class="outcome-btn outcome-make ${state.selectedDist === null ? 'disabled' : ''}"
                onclick="Round.logPutt(true)" ${state.selectedDist === null ? 'disabled' : ''}>
          <span class="outcome-icon">◎</span>
          Made it
        </button>
      </div>

      <!-- Recent log -->
      ${log.length > 0 ? `
        <div class="round-log-header">
          <span class="section-label" style="margin:0">Recent putts</span>
          <button class="undo-btn" onclick="Round.undo()">Undo last</button>
        </div>
        <div class="round-log" id="round-log">
          ${[...log].reverse().slice(0, 10).map((p, i) => `
            <div class="log-row ${p.made ? 'log-made' : 'log-miss'}">
              <span class="log-dist">${p.dist_ft} ft</span>
              <span class="log-outcome">${p.made ? '◎ Made' : '✕ Miss'}</span>
            </div>
          `).join('')}
        </div>
      ` : `<p class="round-empty">Select a distance, then tap Miss or Made.</p>`}

      <!-- End round -->
      ${log.length > 0 ? `
        <button class="end-round-btn" onclick="Round.endRound()">End Round</button>
      ` : ''}
    `;
  }

  function selectDist(d) {
    state.selectedDist = (state.selectedDist === d) ? null : d;  // toggle off if tapped again
    persist();
    render();
  }

  function logPutt(made) {
    if (state.selectedDist === null) return;
    state.putts.push({
      dist_ft: state.selectedDist,
      made,
      timestamp: new Date().toISOString(),
    });
	state.selectedDist = null;
    persist();
    // Keep distance selected for quick repeat logging
    render();
    // Flash feedback
    flashOutcome(made);
  }

  function flashOutcome(made) {
    const el = document.createElement('div');
    el.className = 'putt-flash ' + (made ? 'flash-make' : 'flash-miss');
    el.textContent = made ? '◎' : '✕';
    document.getElementById('app').appendChild(el);
    setTimeout(() => el.remove(), 600);
  }

  function undo() {
    if (state.putts.length === 0) return;
    state.putts.pop();
    persist();
    render();
  }

  function endRound() {
    if (state.putts.length === 0) return;
    renderRoundSummary();
  }

  function renderRoundSummary() {
    const body = document.getElementById('round-body');
    const putts = state.putts;
    const total = putts.length;
    const made  = putts.filter(p => p.made).length;
    const overallPct = Math.round((made / total) * 100);

    // Group by distance
    const byDist = {};
    ROUND_DISTANCES_FT.forEach(d => { byDist[d] = { made: 0, total: 0 }; });
    putts.forEach(p => {
      byDist[p.dist_ft].made  += p.made ? 1 : 0;
      byDist[p.dist_ft].total += 1;
    });

    const distRows = ROUND_DISTANCES_FT
      .filter(d => byDist[d].total > 0)
      .map(d => {
        const { made: m, total: t } = byDist[d];
        const pct = Math.round((m / t) * 100);
        return `
          <div class="summary-row">
            <span class="summary-dist">${d-11}-${d} ft</span>
            <span class="summary-makes">${m}/${t}</span>
            <span class="summary-pct">${pct}%</span>
          </div>
        `;
      }).join('');
	  
	// C1X = 11ft–33ft (the 11ft and 22ft buckets) and C2 33-66ft
    const c1xDists = ROUND_DISTANCES_FT.filter(d => d > 11 && d <= 33);
    const c1xMade  = c1xDists.reduce((s, d) => s + byDist[d].made, 0);
    const c1xTotal = c1xDists.reduce((s, d) => s + byDist[d].total, 0);
	const c2Dists = ROUND_DISTANCES_FT.filter(d => d > 33);
    const c2Made  = c2Dists.reduce((s, d) => s + byDist[d].made, 0);
    const c2Total = c2Dists.reduce((s, d) => s + byDist[d].total, 0);
    const c1xRow   = c1xTotal > -1 ? `
		<div style="width:50%; margin:1px auto 0;">
			<div class="summary-row">
				<span class="summary-dist">C1X</span>
				<span class="summary-makes">${c1xMade}/${c1xTotal}</span>
				<span class="summary-pct">${Math.round((c1xMade / c1xTotal) * 100)}%</span>
			</div>
		</div>` : '';
	const c2Row   = c2Total > -1 ? `
		<div style="width:50%; margin:1px auto 0;">
			<div class="summary-row">
				<span class="summary-dist">C2</span>
				<span class="summary-makes">${c2Made}/${c2Total}</span>
				<span class="summary-pct">${Math.round((c2Made / c2Total) * 100)}%</span>
			</div>
		</div>` : '';
	  

    body.innerHTML = `
      <div class="summary-total">
        <div class="summary-total-pct">${overallPct}%</div>
        <div class="summary-total-label">${made} of ${total} putts</div>
		${c1xRow}
		${c2Row}
      </div>
      <div class="summary-card">
        <div class="summary-title">By Distance</div>
        ${distRows}
      </div>
      <button class="done-btn" onclick="Round.saveAndExit()">Save & Done</button>
    `;

    // Hide back button during summary
    const backBtn = document.querySelector('#screen-round .back-btn');
    if (backBtn) backBtn.style.visibility = 'hidden';
  }

  function saveAndExit() {
    const record = {
      date: new Date().toISOString(),
      putts: state.putts,
    };
    Storage.saveRoundPutt(record);
    Storage.clearActiveRound();

    // Reset
    state.putts = [];
    state.selectedDist = null;
    state.active = false;

    // Restore back button
    const backBtn = document.querySelector('#screen-round .back-btn');
    if (backBtn) backBtn.style.visibility = '';

    nav('screen-home');
  }

  function init() {
    // Resume an in-progress round if one was persisted (e.g. after a reload)
    const saved = Storage.getActiveRound();
    if (saved && saved.putts && saved.putts.length > 0) {
      state.putts = saved.putts;
      state.selectedDist = saved.selectedDist || null;
    } else {
      state.putts = [];
      state.selectedDist = null;
    }
    state.active = true;
    persist();
    render();
  }

  return { init, render, selectDist, logPutt, undo, endRound, saveAndExit };
})();
