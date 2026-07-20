// app.js — initialization

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  });
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    Theme.init();
    Practice.renderSetup();
	
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
        toggle.checked = Theme.get() === "uiuc";
        toggle.addEventListener("change", () => {
            Theme.set(toggle.checked ? "uiuc" : "default");
        });
    }

    const saved = Storage.getActiveRound();
    if (saved && saved.putts && saved.putts.length > 0) {
        nav("screen-round");
        Round.init();
    }
});

// Enable themes
const Theme = (() => {
    const KEY = "theme";
    function get() {
        return localStorage.getItem(KEY) || "default"; // "default" or "uiuc"
    }
    function set(theme) {
        localStorage.setItem(KEY, theme);
        document.documentElement.dataset.theme = theme;
        updateLogo(theme);
    }
    function init() {
        set(get());
    }
    return { get, set, init };
})();

function updateLogo(theme){
    const logo=document.getElementById("appLogo");
    if(!logo) return;
    if(theme==="uiuc"){
        logo.textContent="I";
        logo.classList.add("block-i");
    }else{
        logo.textContent="⬤";
        logo.classList.remove("block-i");
    }

    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta){
        meta.content=
            theme==="uiuc"
            ? "#13294B"
            : "#1a2e1a";
    }
}
