// app.js — initialization

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  });
}

// Initialize screens on load
window.addEventListener('DOMContentLoaded', () => {
  Practice.renderSetup();
});
