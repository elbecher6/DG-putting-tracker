// practice.js — practice mode logic

// ── Constants ──
const STEPS_TO_FEET = 2.5;   // 1 step ≈ 2.5 feet (adjust if preferred)
const SET_SIZES = [3, 5, 10];
const MIN_DIST_STEPS = 5;
const MAX_DIST_STEPS = 40;

// ── State ──
const Practice = (() => {
  let unit = 'steps';          // 'steps' | 'feet'
  let setup = {
    setSize: 5,
    minDist: 10,
    maxDist: 25,
  };
  let session = {
    active: false,
    putts: [],        // [{dist, makes, attempts}]
    current: 0,       // index into putts
    distances: [],    // randomized distance list
    selectedMakes: null,
  };

  // ── Helpers ──
  function stepsToFeet(s) { return Math.round(s * STEPS_TO_FEET); }
  function feetToSteps(f) { return Math.round(f / STEPS_TO_FEET); }

  function formatDist(steps) {
    return unit === 'steps' ? `${steps}` : `${stepsToFeet(steps)}`;
  }
  function unitLabel() { return unit === 'steps' ? 'steps' : 'ft'; }
  function convertNote(steps) {
    return unit === 'steps'
      ? `≈ ${stepsToFeet(steps)} ft`
      : `≈ ${steps} steps`;
  }

  // Generate randomized distance list for the session
  // One distance per set, randomly chosen in [minDist, maxDist]
  function generateDistances(count, min, max) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return list;
  }

  // ── Setup Screen ──
  function renderSetup() {
    const body = document.getElementById('practice-setup-body');
    body.innerHTML = `
      <p class="section-label">Set Size</p>
      <div class="pill-group" id="set-size-pills">
        ${SET_SIZES.map(n => `
          <button class="pill ${n === setup.setSize ? 'selected' : ''}"
                  onclick="Practice.selectSetSize(${n})">${n} putts</button>
        `).join('')}
      </div>

      <p class="section-label">Min Distance</p>
      <div class="range-row">
        <input type="range" id="min-dist-slider"
               min="${MIN_DIST_STEPS}" max="${MAX_DIST_STEPS}"
               value="${setup.minDist}"
               oninput="Practice.updateMin(this.value)" />
        <span class="range-val" id="min-dist-val">${formatDist(setup.minDist)} <small>${unitLabel()}</small></span>
      </div>

      <p class="section-label">Max Distance</p>
      <div class="range-row">
        <input type="range" id="max-dist-slider"
               min="${MIN_DIST_STEPS}" max="${MAX_DIST_STEPS}"
               value="${setup.maxDist}"
               oninput="Practice.updateMax(this.value)" />
        <span class="range-val" id="max-dist-val">${formatDist(setup.maxDist)} <small>${unitLabel()}</small></span>
      </div>

      <button class="start-btn" onclick="Practice.startSession()">
        Start Practice
      </button>
    `;
  }

  function selectSetSize(n) {
    setup.setSize = n;
    renderSetup();
  }

  function updateMin(val) {
    setup.minDist = parseInt(val);
    if (setup.minDist > setup.maxDist) {
      setup.maxDist = setup.minDist;
      document.getElementById('max-dist-slider').value = setup.maxDist;
    }
    refreshSetupLabels();
  }

  function updateMax(val) {
    setup.maxDist = parseInt(val);
    if (setup.maxDist < setup.minDist) {
      setup.minDist = setup.maxDist;
      document.getElementById('min-dist-slider').value = setup.minDist;
    }
    refreshSetupLabels();
  }

  function refreshSetupLabels() {
    const minEl = document.getElementById('min-dist-val');
    const maxEl = document.getElementById('max-dist-val');
    if (minEl) minEl.innerHTML = `${formatDist(setup.minDist)} <small>${unitLabel()}</small>`;
    if (maxEl) maxEl.innerHTML = `${formatDist(setup.maxDist)} <small>${unitLabel()}</small>`;
  }

  // ── Session ──
  function startSession() {
    session.distances = generateDistances(1, setup.minDist, setup.maxDist);
    // We generate one distance at a time on-the-fly (unlimited sets until user ends)
    session.putts = [];
    session.current = 0;
    session.active = true;
    session.selectedMakes = null;

    nav('screen-practice-session');
    renderSessionPutt();
  }

  function renderSessionPutt() {
    const body = document.getElementById('practice-session-body');
    const dist = session.distances[session.current];
    const setNum = session.current + 1;
    const totalSets = session.distances.length;

    // progress bar fills based on sets completed
    const pct = totalSets > 1 ? Math.round((session.current / totalSets) * 100) : 0;

    body.innerHTML = `
      <div class="session-progress">
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="progress-label">Set ${setNum}</span>
      </div>

      <div class="distance-card">
        <div class="distance-label">Putt from</div>
        <div class="distance-number" id="sess-dist-num">${formatDist(dist)}</div>
        <div class="distance-unit" id="sess-dist-unit">${unitLabel()}</div>
        <div class="distance-convert" id="sess-dist-convert">${convertNote(dist)}</div>
      </div>

      <p class="makes-label">How many did you make? (out of ${setup.setSize})</p>
      <div class="makes-grid" id="makes-grid">
        ${makesButtons(setup.setSize)}
      </div>

      <button class="next-btn" id="next-btn" disabled onclick="Practice.submitSet()">
        Next Set →
      </button>
    `;
  }

  function makesButtons(setSize) {
    let html = '';
    for (let i = 0; i <= setSize; i++) {
      html += `<button class="makes-btn" onclick="Practice.selectMakes(${i})">${i}</button>`;
    }
    return html;
  }

  function selectMakes(n) {
    session.selectedMakes = n;
    document.querySelectorAll('.makes-btn').forEach((btn, i) => {
      btn.classList.toggle('selected', i === n);
    });
    document.getElementById('next-btn').disabled = false;
  }

  function submitSet() {
    if (session.selectedMakes === null) return;
    const dist = session.distances[session.current];

    session.putts.push({
      dist,
      makes: session.selectedMakes,
      attempts: setup.setSize,
    });

    // Generate next distance and advance
    session.current++;
    const nextDist = Math.floor(Math.random() * (setup.maxDist - setup.minDist + 1)) + setup.minDist;
    session.distances.push(nextDist);
    session.selectedMakes = null;

    renderSessionPutt();
  }

  function endPracticeSession() {
    if (session.putts.length === 0) {
      // Nothing recorded yet, just go back
      nav('screen-practice-setup');
      return;
    }
    renderSummary();
  }

  function renderSummary() {
    const body = document.getElementById('practice-session-body');
    const putts = session.putts;
    const totalMakes = putts.reduce((s, p) => s + p.makes, 0);
    const totalAttempts = putts.reduce((s, p) => s + p.attempts, 0);
    const overallPct = totalAttempts > 0 ? Math.round((totalMakes / totalAttempts) * 100) : 0;

    const rows = putts.map(p => {
      const pct = Math.round((p.makes / p.attempts) * 100);
      return `
        <div class="summary-row">
          <span class="summary-dist">${formatDist(p.dist)} ${unitLabel()}</span>
          <span class="summary-makes">${p.makes}/${p.attempts}</span>
          <span class="summary-pct">${pct}%</span>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="summary-total">
        <div class="summary-total-pct">${overallPct}%</div>
        <div class="summary-total-label">${totalMakes} of ${totalAttempts} putts — ${putts.length} sets</div>
      </div>
      <div class="summary-card">
        <div class="summary-title">By Set</div>
        ${rows}
      </div>
      <button class="done-btn" onclick="Practice.saveAndExit()">Save & Done</button>
    `;

    // Update header to hide back button navigating away
    const header = document.querySelector('#screen-practice-session .screen-header');
    const backBtn = header.querySelector('.back-btn');
    if (backBtn) backBtn.style.visibility = 'hidden';
  }

  function saveAndExit() {
    const sessionRecord = {
      date: new Date().toISOString(),
      setSize: setup.setSize,
      unit,
      putts: session.putts,
    };
    Storage.savePracticeSession(sessionRecord);

    // Reset
    session.active = false;
    session.putts = [];
    session.current = 0;
    session.distances = [];

    // Restore back button visibility
    const backBtn = document.querySelector('#screen-practice-session .back-btn');
    if (backBtn) backBtn.style.visibility = '';

    nav('screen-home');
  }

  // ── Unit toggle (called from HTML) ──
  function setUnit(u) {
    unit = u;
    document.getElementById('unit-steps-btn')?.classList.toggle('active', u === 'steps');
    document.getElementById('unit-feet-btn')?.classList.toggle('active', u === 'feet');

    // Refresh whichever screen is visible
    if (session.active) {
      // Update distance display without re-rendering the whole putt
      const dist = session.distances[session.current];
      if (dist !== undefined) {
        const numEl = document.getElementById('sess-dist-num');
        const unitEl = document.getElementById('sess-dist-unit');
        const convEl = document.getElementById('sess-dist-convert');
        if (numEl) numEl.textContent = formatDist(dist);
        if (unitEl) unitEl.textContent = unitLabel();
        if (convEl) convEl.textContent = convertNote(dist);
      }
    } else {
      refreshSetupLabels();
    }
  }

  return {
    renderSetup,
    selectSetSize,
    updateMin,
    updateMax,
    startSession,
    selectMakes,
    submitSet,
    endPracticeSession,
    saveAndExit,
    setUnit,
  };
})();

// Expose globals needed by HTML onclick attributes
function setUnit(u) { Practice.setUnit(u); }
function endPracticeSession() { Practice.endPracticeSession(); }
