// On-screen keyboard. Typing a search with a thumbstick has to feel decent or
// the whole thing falls apart, so keys are big and the grid wraps sensibly.
(function () {
  const ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
  ];

  const ACTIONS = [
    { key: ' ', label: 'Space', cls: 'wide' },
    { key: '\b', label: 'Delete', cls: 'wide' },
    { key: '\x00', label: 'Clear', cls: 'wide' },
    { key: '\n', label: 'Search', cls: 'wide go' },
  ];

  let scrim = null;
  let panel = null;
  let keys = [];
  let selected = null;
  let text = '';
  let onSubmit = null;
  let open = false;

  function build() {
    const el = CT.ui.el;
    scrim = el('div', 'scrim');
    panel = el('div', 'panel osk');
    panel.innerHTML = `
      <div class="head">
        <h2>Search YouTube</h2>
        <div class="brand"><span class="dot"></span>CouchTube</div>
      </div>
      <div class="field"><span class="txt"></span><span class="caret"></span></div>
      <div class="keys"></div>`;

    const keyWrap = panel.querySelector('.keys');
    keys = [];

    for (const row of ROWS) {
      const rowNode = el('div', 'row');
      for (const ch of row) {
        const k = el('div', 'key', ch);
        k.dataset.key = ch;
        keys.push(k);
        rowNode.appendChild(k);
      }
      keyWrap.appendChild(rowNode);
    }

    const actionRow = el('div', 'row');
    for (const a of ACTIONS) {
      const k = el('div', 'key ' + a.cls, a.label);
      k.dataset.key = a.key;
      keys.push(k);
      actionRow.appendChild(k);
    }
    keyWrap.appendChild(actionRow);

    CT.ui.layer.append(scrim, panel);
  }

  function renderText() {
    const field = panel.querySelector('.txt');
    if (text) {
      field.className = 'txt';
      field.textContent = text;
    } else {
      field.className = 'txt ph';
      field.textContent = 'What do you want to watch?';
    }
  }

  function select(node) {
    if (!node) return;
    if (selected) selected.classList.remove('sel');
    selected = node;
    selected.classList.add('sel');
  }

  function show(initial, submit) {
    if (open) return;
    open = true;
    text = initial || '';
    onSubmit = submit;
    build();
    renderText();
    // Let the browser paint the panel before the transitions kick in.
    requestAnimationFrame(() => {
      scrim.classList.add('on');
      panel.classList.add('on');
      select(keys.find((k) => k.dataset.key === 's') || keys[0]);
    });
    CT.ui.setHints([
      ['dpad', 'Move'],
      ['confirm', 'Type'],
      ['x', 'Delete'],
      ['r1', 'Space'],
      ['start', 'Search'],
      ['back', 'Cancel'],
    ]);
  }

  function hide() {
    if (!open) return;
    open = false;
    if (scrim) scrim.remove();
    if (panel) panel.remove();
    scrim = panel = selected = null;
    keys = [];
  }

  function type(ch) {
    if (ch === '\b') text = text.slice(0, -1);
    else if (ch === '\x00') text = '';
    else if (ch === '\n') return submit();
    else text += ch;
    renderText();
    return true;
  }

  function submit() {
    const q = text.trim();
    hide();
    if (q && onSubmit) onSubmit(q);
    return true;
  }

  // Returns true when the keyboard consumed the action.
  function handle(action) {
    if (!open) return false;
    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        select(CT.spatial.pickFrom(selected, keys, action) || selected);
        return true;
      case 'confirm':
        if (selected) type(selected.dataset.key);
        return true;
      case 'x':
        type('\b');
        return true;
      case 'r1':
        type(' ');
        return true;
      case 'l1':
        type('\b');
        return true;
      case 'y':
      case 'start':
        submit();
        return true;
      case 'back':
        hide();
        CT.bus.emit('osk:closed');
        return true;
      default:
        return true;
    }
  }

  CT.osk = {
    show,
    hide,
    handle,
    get open() {
      return open;
    },
  };
})();
