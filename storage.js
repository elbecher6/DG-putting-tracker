// storage.js — thin wrapper around localStorage

const Storage = (() => {
  const PREFIX = 'putttracker_';

  function get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  }

  // Append a record to an array stored at key
  function append(key, record) {
    const arr = get(key) || [];
    arr.push(record);
    set(key, arr);
  }

  // Get all practice sessions
  function getPracticeSessions() {
    return get('practice_sessions') || [];
  }

  // Save a completed practice session
  function savePracticeSession(session) {
    append('practice_sessions', session);
  }

  // Get all round putts
  function getRoundPutts() {
    return get('round_putts') || [];
  }

  // Save a single round putt attempt
  function saveRoundPutt(putt) {
    append('round_putts', putt);
  }

  return { get, set, getPracticeSessions, savePracticeSession, getRoundPutts, saveRoundPutt };
})();
