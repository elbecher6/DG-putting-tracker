// sessions.js — sessions list screen

const Sessions = (() => {

  let mode = 'practice'; // 'round' | 'practice'

  // ── Helpers ──
  function formatDate(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // ── Session summaries ──
  function roundSessionSummary(sess) {
    const putts = sess.putts || [];
    const total = putts.length;
    const made  = putts.filter(p => p.made).length;
    const pct   = total > 0 ? Math.round((made / total) * 100) : null;
    return { total, made, pct };
  }

  function practiceSessionSummary(sess) {
    const putts = sess.putts || [];
    const total = putts.reduce((s, p) => s + p.attempts, 0);
    const made  = putts.reduce((s, p) => s + p.makes, 0);
    const sets  = putts.length;
    const pct   = total > 0 ? Math.round((made / total) * 100) : null;
    return { total, made, pct, sets };
  }

  // ── Delete ──
  function deleteSession(index) {
    const key = mode === 'round' ? 'putttracker_round_putts' : 'putttracker_practice_sessions';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const arr = JSON.parse(raw);
    arr.splice(index, 1);
    localStorage.setItem(key, JSON.stringify(arr));
    render();
  }

  // ── Export single session as CSV ──
  function exportSession(index) {
    const sessions = mode === 'round'
      ? Storage.getRoundPutts()
      : Storage.getPracticeSessions();
    const sess = sessions[index];
    if (!sess) return;

    let rows = [
      ['Putt Tracker Session Export'],
      ['Mode: ' + (mode === 'round' ? 'In Round' : 'Practice')],
      ['Date: ' + formatDate(sess.date)],
      ['Time: ' + formatTime(sess.date)],
      [],
    ];

    if (mode === 'round') {
      rows.push(['Distance (ft)', 'Result']);
      (sess.putts || []).forEach(p => {
        rows.push([p.dist_ft, p.made ? 'Made' : 'Miss']);
      });
      const { total, made, pct } = roundSessionSummary(sess);
      rows.push([]);
      rows.push(['Total', made + '/' + total, pct !== null ? pct + '%' : '-']);
    } else {
      rows.push(['Set', 'Distance (' + (sess.unit || 'steps') + ')', 'Made', 'Attempts', '%']);
      (sess.putts || []).forEach((p, i) => {
        const pct = p.attempts > 0 ? Math.round((p.makes / p.attempts) * 100) + '%' : '-';
        rows.push([i + 1, p.dist, p.makes, p.attempts, pct]);
      });
      const { total, made, pct } = practiceSessionSummary(sess);
      rows.push([]);
      rows.push(['Total', '', made + '/' + total, '', pct !== null ? pct + '%' : '-']);
    }

    const csv = rows.map(row =>
      row.map(cell => {
        const s = String(cell);
        return s.includes(',') ? '"' + s + '"' : s;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `session-${mode}-${sess.date.slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ──
  function render() {
    const body = document.getElementById('sessions-body');
    if (!body) return;

    const sessions = mode === 'round'
      ? Storage.getRoundPutts()
      : Storage.getPracticeSessions();

    // Show most recent first
    const indexed = sessions.map((s, i) => ({ sess: s, index: i })).reverse();

    const modeToggle = `
      <div class="stats-mode-toggle">
        <button class="stats-mode-btn ${mode === 'round' ? 'active' : ''}"
                onclick="Sessions.setMode('round')">In Round</button>
        <button class="stats-mode-btn ${mode === 'practice' ? 'active' : ''}"
                onclick="Sessions.setMode('practice')">Practice</button>
      </div>
    `;

    if (indexed.length === 0) {
      body.innerHTML = modeToggle + `<p class="stats-empty">No ${mode === 'round' ? 'in-round' : 'practice'} sessions saved yet.</p>`;
      return;
    }

    const cards = indexed.map(({ sess, index }) => {
      const dateStr = formatDate(sess.date);
      const timeStr = formatTime(sess.date);

      let summaryLine, detailLine;
      if (mode === 'round') {
        const { total, made, pct } = roundSessionSummary(sess);
        summaryLine = `${made}/${total} putts &mdash; ${pct !== null ? pct + '%' : '&mdash;'}`;
        // Build compact distance breakdown
        const byDist = {};
        (sess.putts || []).forEach(p => {
          if (!byDist[p.dist_ft]) byDist[p.dist_ft] = { made: 0, total: 0 };
          byDist[p.dist_ft].made  += p.made ? 1 : 0;
          byDist[p.dist_ft].total += 1;
        });
        detailLine = Object.entries(byDist)
          .sort((a, b) => a[0] - b[0])
          .map(([d, v]) => `${d}ft: ${v.made}/${v.total}`)
          .join(' &middot; ');
      } else {
        const { total, made, pct, sets } = practiceSessionSummary(sess);
        summaryLine = `${sets} sets &mdash; ${made}/${total} putts &mdash; ${pct !== null ? pct + '%' : '&mdash;'}`;
        detailLine  = `Set size: ${sess.setSize || '?'} &middot; Unit: ${sess.unit || 'steps'}`;
      }

      return `
        <div class="session-card">
          <div class="session-card-header">
            <div>
              <div class="session-date">${dateStr}</div>
              <div class="session-time">${timeStr}</div>
            </div>
            <div class="session-pct">${
              mode === 'round'
                ? (roundSessionSummary(sess).pct !== null ? roundSessionSummary(sess).pct + '%' : '&mdash;')
                : (practiceSessionSummary(sess).pct !== null ? practiceSessionSummary(sess).pct + '%' : '&mdash;')
            }</div>
          </div>
          <div class="session-summary">${summaryLine}</div>
          <div class="session-detail">${detailLine}</div>
          <div class="session-actions">
            <button class="session-export-btn" onclick="Sessions.exportSession(${index})">&#8681; Export CSV</button>
            <button class="session-delete-btn" onclick="Sessions.confirmDelete(${index})">&#128465; Delete</button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = modeToggle + cards;
  }

  function confirmDelete(index) {
    const sessions = mode === 'round'
      ? Storage.getRoundPutts()
      : Storage.getPracticeSessions();
    const sess = sessions[index];
    if (!sess) return;
    const dateStr = formatDate(sess.date);
    if (confirm(`Delete the ${mode === 'round' ? 'in-round' : 'practice'} session from ${dateStr}? This cannot be undone.`)) {
      deleteSession(index);
    }
  }

  function setMode(m) { mode = m; render(); }
  function init() { render(); }

  return { init, render, setMode, exportSession, confirmDelete };
})();