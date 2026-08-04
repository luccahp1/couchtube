// Button index -> semantic action, using the W3C "standard" gamepad layout that
// Chromium reports for basically every Xbox / PlayStation / 8BitDo pad.
(function () {
  const BUTTONS = {
    0: 'confirm',
    1: 'back',
    2: 'x',
    3: 'y',
    4: 'l1',
    5: 'r1',
    6: 'l2',
    7: 'r2',
    8: 'select',
    9: 'start',
    10: 'l3',
    11: 'r3',
    12: 'up',
    13: 'down',
    14: 'left',
    15: 'right',
    16: 'home',
  };

  // Directions repeat while held, everything else fires once per press.
  const REPEATABLE = new Set(['up', 'down', 'left', 'right', 'l2', 'r2']);

  // Shared across every glyph set, the d-pad is the d-pad on all of them.
  const DIRECTIONS = {
    up: { label: '↑', color: '#9aa3b2' },
    down: { label: '↓', color: '#9aa3b2' },
    left: { label: '←', color: '#9aa3b2' },
    right: { label: '→', color: '#9aa3b2' },
    dpad: { label: '✚', color: '#9aa3b2' },
  };

  const GLYPHS = {
    xbox: {
      confirm: { label: 'A', color: '#5cd05c' },
      back: { label: 'B', color: '#f2564b' },
      x: { label: 'X', color: '#4c8dff' },
      y: { label: 'Y', color: '#f5c945' },
      l1: { label: 'LB', color: '#9aa3b2', wide: true },
      r1: { label: 'RB', color: '#9aa3b2', wide: true },
      l2: { label: 'LT', color: '#9aa3b2', wide: true },
      r2: { label: 'RT', color: '#9aa3b2', wide: true },
      start: { label: '≡', color: '#9aa3b2' },
      select: { label: '⧉', color: '#9aa3b2' },
      l3: { label: 'L3', color: '#9aa3b2', wide: true },
      r3: { label: 'R3', color: '#9aa3b2', wide: true },
      dpad: { label: '✚', color: '#9aa3b2' },
    },
    playstation: {
      confirm: { label: '✕', color: '#8fa9ff' },
      back: { label: '○', color: '#f2564b' },
      x: { label: '□', color: '#f18fd0' },
      y: { label: '△', color: '#5cd0c0' },
      l1: { label: 'L1', color: '#9aa3b2', wide: true },
      r1: { label: 'R1', color: '#9aa3b2', wide: true },
      l2: { label: 'L2', color: '#9aa3b2', wide: true },
      r2: { label: 'R2', color: '#9aa3b2', wide: true },
      start: { label: 'OPT', color: '#9aa3b2', wide: true },
      select: { label: 'SHR', color: '#9aa3b2', wide: true },
      l3: { label: 'L3', color: '#9aa3b2', wide: true },
      r3: { label: 'R3', color: '#9aa3b2', wide: true },
      dpad: { label: '✚', color: '#9aa3b2' },
    },
    generic: {
      confirm: { label: '1', color: '#5cd05c' },
      back: { label: '2', color: '#f2564b' },
      x: { label: '3', color: '#4c8dff' },
      y: { label: '4', color: '#f5c945' },
      l1: { label: 'L1', color: '#9aa3b2', wide: true },
      r1: { label: 'R1', color: '#9aa3b2', wide: true },
      l2: { label: 'L2', color: '#9aa3b2', wide: true },
      r2: { label: 'R2', color: '#9aa3b2', wide: true },
      start: { label: 'START', color: '#9aa3b2', wide: true },
      select: { label: 'SELECT', color: '#9aa3b2', wide: true },
      l3: { label: 'L3', color: '#9aa3b2', wide: true },
      r3: { label: 'R3', color: '#9aa3b2', wide: true },
      dpad: { label: '✚', color: '#9aa3b2' },
    },
  };

  // Arrow keys and friends, for testing on a laptop or when the pad is charging.
  const KEYS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'confirm',
    Backspace: 'back',
    Escape: 'back',
    KeyX: 'x',
    KeyC: 'y',
    BracketLeft: 'l1',
    BracketRight: 'r1',
    Tab: 'start',
  };

  CT.mapping = {
    BUTTONS,
    REPEATABLE,
    KEYS,
    glyph(action) {
      const set = GLYPHS[CT.settings.values.glyphs] || GLYPHS.xbox;
      return set[action] || DIRECTIONS[action] || { label: action.toUpperCase(), color: '#9aa3b2', wide: true };
    },
  };
})();
