// Polls the Gamepad API and turns raw button state into semantic actions with
// console-style auto-repeat. Nothing else in the codebase touches navigator.getGamepads.
(function () {
  const held = new Map(); // action -> { since, nextRepeat }
  let running = false;
  let connected = 0;
  let lastActivity = 0;

  function now() {
    return performance.now();
  }

  function fire(action, repeat) {
    lastActivity = now();
    CT.bus.emit('action', { action, repeat: !!repeat });
  }

  function press(action) {
    if (held.has(action)) return;
    const s = CT.settings.values;
    held.set(action, { since: now(), nextRepeat: now() + s.repeatDelay });
    fire(action, false);
  }

  function release(action) {
    held.delete(action);
  }

  function tickRepeats() {
    const s = CT.settings.values;
    const t = now();
    for (const [action, state] of held) {
      if (!CT.mapping.REPEATABLE.has(action)) continue;
      if (t >= state.nextRepeat) {
        // Accelerate a little the longer it is held, like a real console menu.
        const heldFor = t - state.since;
        const rate = heldFor > 2000 ? s.repeatRate * 0.55 : s.repeatRate;
        state.nextRepeat = t + rate;
        fire(action, true);
      }
    }
  }

  // Left stick doubles as a d-pad. Right stick does free scrolling.
  function axesToActions(pad, pressedSet) {
    const dz = CT.settings.values.deadzone;
    const lx = pad.axes[0] || 0;
    const ly = pad.axes[1] || 0;
    if (lx <= -dz) pressedSet.add('left');
    if (lx >= dz) pressedSet.add('right');
    if (ly <= -dz) pressedSet.add('up');
    if (ly >= dz) pressedSet.add('down');

    const rx = pad.axes[2] || 0;
    const ry = pad.axes[3] || 0;
    if (Math.abs(rx) > dz || Math.abs(ry) > dz) {
      lastActivity = now();
      CT.bus.emit('analog', { x: rx, y: ry });
    }
  }

  function poll() {
    if (!running) return;
    requestAnimationFrame(poll);

    let pads;
    try {
      pads = navigator.getGamepads ? navigator.getGamepads() : [];
    } catch (err) {
      pads = [];
    }

    const pressedSet = new Set();
    let live = 0;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      live++;
      for (let i = 0; i < pad.buttons.length; i++) {
        const action = CT.mapping.BUTTONS[i];
        if (!action) continue;
        const btn = pad.buttons[i];
        const down = typeof btn === 'object' ? btn.pressed || btn.value > 0.5 : btn > 0.5;
        if (down) pressedSet.add(action);
      }
      axesToActions(pad, pressedSet);
    }

    if (live !== connected) {
      connected = live;
      CT.bus.emit('pads', { count: live });
    }

    for (const action of pressedSet) press(action);
    for (const action of [...held.keys()]) {
      if (!pressedSet.has(action)) release(action);
    }
    tickRepeats();
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(poll);
  }

  function stop() {
    running = false;
    held.clear();
  }

  window.addEventListener('gamepadconnected', (e) => {
    CT.log('pad connected', e.gamepad && e.gamepad.id);
    CT.bus.emit('pads', { count: 1, id: e.gamepad && e.gamepad.id, justConnected: true });
  });
  window.addEventListener('gamepaddisconnected', () => {
    CT.bus.emit('pads', { count: 0 });
  });

  // Keyboard fallback so the whole thing is usable (and testable) without a pad.
  window.addEventListener(
    'keydown',
    (e) => {
      if (!CT.settings.values.keyboardFallback) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      // Never steal keys from a real text field.
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const action = CT.mapping.KEYS[e.code];
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      fire(action, e.repeat);
    },
    true
  );

  // Test/automation bridge: anything on the page can dispatch
  //   document.dispatchEvent(new CustomEvent('couchtube:inject', { detail: 'confirm' }))
  // and it lands here exactly like a real button press.
  document.addEventListener('couchtube:inject', (e) => {
    const action = typeof e.detail === 'string' ? e.detail : e.detail && e.detail.action;
    if (action) fire(action, false);
  });

  CT.gamepad = {
    start,
    stop,
    get connected() {
      return connected;
    },
    get lastActivity() {
      return lastActivity;
    },
    isHeld: (action) => held.has(action),
    heldFor: (action) => (held.has(action) ? now() - held.get(action).since : 0),
  };
})();
