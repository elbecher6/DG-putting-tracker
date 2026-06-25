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

  function remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (e) {
      console.warn('Storage remove failed', e);
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

  // Active (in-progress) round — persisted after every putt so a reload can resume it
  function getActiveRound() {
    return get('active_round');
  }
  function setActiveRound(round) {
    set('active_round', round);
  }
  function clearActiveRound() {
    remove('active_round');
  }

  return {
    get, set,
    getPracticeSessions, savePracticeSession,
    getRoundPutts, saveRoundPutt,
    getActiveRound, setActiveRound, clearActiveRound,
  };
})();
