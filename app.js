// app.js — initialization

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  });
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  Practice.renderSetup();

  // If a round was in progress when the page reloaded/closed, jump straight back into it
  const saved = Storage.getActiveRound();
  if (saved && saved.putts && saved.putts.length > 0) {
    nav('screen-round');
    Round.init();
  }
});
