const DEFAULTS = {
  enabled: true,
  glyphs: 'xbox',
  deadzone: 0.45,
  repeatDelay: 380,
  repeatRate: 110,
  seekStep: 10,
  seekStepBig: 60,
  volumeStep: 5,
  hudTimeout: 3200,
  bigMode: false,
  bigModeZoom: 1.3,
  hideCursor: true,
  keyboardFallback: false,
  autoTheater: true,
};

const saved = document.getElementById('saved');
let savedTimer = null;

function flashSaved() {
  saved.classList.add('on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => saved.classList.remove('on'), 1200);
}

function readValue(node) {
  if (node.type === 'checkbox') return node.checked;
  if (node.type === 'range') return parseFloat(node.value);
  return node.value;
}

function writeValue(node, value) {
  if (node.type === 'checkbox') node.checked = !!value;
  else node.value = value;
  syncOutput(node);
}

function syncOutput(node) {
  const out = document.querySelector(`output[data-for="${node.id}"]`);
  if (!out) return;
  const unit = out.dataset.unit || '';
  const v = node.type === 'range' ? parseFloat(node.value) : node.value;
  out.textContent = (unit === 'ms' ? Math.round(v) : v) + unit;
}

function bind(values) {
  for (const key of Object.keys(DEFAULTS)) {
    const node = document.getElementById(key);
    if (!node) continue;
    writeValue(node, values[key]);
    const evt = node.type === 'range' ? 'input' : 'change';
    node.addEventListener(evt, () => {
      syncOutput(node);
      chrome.storage.sync.set({ [key]: readValue(node) }, flashSaved);
    });
  }
}

chrome.storage.sync.get(DEFAULTS, bind);

document.getElementById('reset').addEventListener('click', () => {
  chrome.storage.sync.set(DEFAULTS, () => {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      const node = document.getElementById(key);
      if (node) writeValue(node, value);
    }
    flashSaved();
  });
});

// --------------------------------------------------------- controller test

const LABELS = [
  'A', 'B', 'X', 'Y', 'LB', 'RB',
  'LT', 'RT', 'View', 'Menu', 'L3', 'R3',
  'Up', 'Down', 'Left', 'Right', 'Guide',
];

const padsWrap = document.getElementById('pads');
const cells = LABELS.map((label) => {
  const node = document.createElement('div');
  node.className = 'btn';
  node.textContent = label;
  padsWrap.appendChild(node);
  return node;
});

const padId = document.getElementById('padId');
const lstick = document.getElementById('lstick');
const rstick = document.getElementById('rstick');

function pollPads() {
  requestAnimationFrame(pollPads);
  const pads = (navigator.getGamepads ? navigator.getGamepads() : []) || [];
  const pad = [...pads].find((p) => p && p.connected);

  if (!pad) {
    padId.textContent = 'Press a button on your controller.';
    cells.forEach((c) => c.classList.remove('on'));
    return;
  }

  padId.textContent = pad.id;
  for (let i = 0; i < cells.length; i++) {
    const btn = pad.buttons[i];
    const down = btn && (btn.pressed || btn.value > 0.5);
    cells[i].classList.toggle('on', !!down);
  }

  const nudge = (node, x, y) => {
    node.style.setProperty('--x', (x || 0) * 26 + 'px');
    node.style.setProperty('--y', (y || 0) * 26 + 'px');
  };
  nudge(lstick, pad.axes[0], pad.axes[1]);
  nudge(rstick, pad.axes[2], pad.axes[3]);
}
pollPads();
