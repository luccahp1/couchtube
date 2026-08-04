// Quick toggles. Everything writes straight to chrome.storage.sync and the
// content script picks the change up through its storage listener.
const FIELDS = ['enabled', 'bigMode', 'hideCursor', 'keyboardFallback', 'glyphs'];

const DEFAULTS = {
  enabled: true,
  bigMode: false,
  hideCursor: true,
  keyboardFallback: false,
  glyphs: 'xbox',
};

chrome.storage.sync.get(DEFAULTS, (values) => {
  for (const key of FIELDS) {
    const node = document.getElementById(key);
    if (!node) continue;
    if (node.type === 'checkbox') node.checked = !!values[key];
    else node.value = values[key];
    node.addEventListener('change', () => {
      const value = node.type === 'checkbox' ? node.checked : node.value;
      chrome.storage.sync.set({ [key]: value });
    });
  }
});

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// The popup has its own window, so it sees the same gamepads the page does.
function pollPads() {
  const pads = (navigator.getGamepads ? navigator.getGamepads() : []) || [];
  const live = [...pads].filter((p) => p && p.connected);
  const dot = document.getElementById('dot');
  const text = document.getElementById('statusText');
  if (live.length) {
    dot.classList.add('live');
    text.textContent = live[0].id.replace(/\s*\([^)]*\)\s*$/, '').slice(0, 38) || 'Controller ready';
  } else {
    dot.classList.remove('live');
    text.textContent = 'No controller seen yet — press a button';
  }
  requestAnimationFrame(pollPads);
}
pollPads();
