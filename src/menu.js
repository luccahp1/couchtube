// The controls cheat sheet. Press Start and it tells you every binding for the
// mode you are actually in, so nobody has to memorise a README from the couch.
(function () {
  let scrim = null;
  let panel = null;
  let open = false;

  // Built fresh every time it opens, because a couple of the bindings are
  // named after whichever site you are on.
  function sheet() {
    const labels = CT.site.labels;
    return {
      player: [
        ['confirm', 'Play / pause'],
        ['back', 'Fullscreen out, then browse'],
        ['left', 'Back 10s (hold to scrub)'],
        ['right', 'Forward 10s (hold to scrub)'],
        ['up', 'Volume up'],
        ['down', 'Volume down'],
        ['x', 'Captions'],
        ['y', 'Fullscreen'],
        ['l1', 'Back 60s'],
        ['r1', 'Forward 60s'],
        ['l2', 'Slower'],
        ['r2', 'Faster'],
        ['l3', 'Mute'],
        ['r3', CT.site.skipAvailable ? 'Skip intro, else ' + labels.next.toLowerCase() : labels.next],
        ['select', 'Switch to browse'],
      ],
      browse: [
        ['dpad', 'Move focus'],
        ['confirm', 'Open'],
        ['back', 'Go back'],
        ['x', 'Search'],
        ['y', 'Couch zoom'],
        ['l1', 'Page up'],
        ['r1', 'Page down'],
        ['l3', 'Show mouse'],
        ['select', 'Back to the player'],
        ['home', labels.home],
      ],
    };
  }

  function rows(list) {
    const el = CT.ui.el;
    const wrap = el('div', 'rows');
    for (const [action, label] of list) {
      const row = el('div', 'row2');
      row.appendChild(CT.ui.glyphNode(action));
      row.appendChild(el('span', null, label));
      wrap.appendChild(row);
    }
    return wrap;
  }

  function build(mode) {
    const el = CT.ui.el;
    scrim = el('div', 'scrim');
    panel = el('div', 'panel menu');
    panel.innerHTML = `
      <div class="head">
        <h2>Controls</h2>
        <div class="brand"><span class="dot"></span>CouchTube on ${CT.site.label}</div>
      </div>
      <div class="body"></div>
      <div class="foot"></div>`;

    const body = panel.querySelector('.body');
    const sheets = sheet();
    const order = mode === 'player' ? ['player', 'browse'] : ['browse', 'player'];
    for (const key of order) {
      const group = el('div', 'group');
      group.appendChild(el('h3', null, key === 'player' ? 'Player' : 'Browsing'));
      group.appendChild(rows(sheets[key]));
      body.appendChild(group);
    }

    const foot = panel.querySelector('.foot');
    foot.appendChild(CT.ui.glyphNode('back'));
    foot.appendChild(el('span', null, 'Close'));
    foot.appendChild(el('span', null, '·'));
    foot.appendChild(el('span', null, 'More settings live in the CouchTube toolbar popup'));

    CT.ui.layer.append(scrim, panel);
  }

  function show(mode) {
    if (open) return;
    open = true;
    build(mode);
    requestAnimationFrame(() => {
      scrim.classList.add('on');
      panel.classList.add('on');
    });
    CT.ui.hideHints();
  }

  function hide() {
    if (!open) return;
    open = false;
    if (scrim) scrim.remove();
    if (panel) panel.remove();
    scrim = panel = null;
  }

  function handle(action) {
    if (!open) return false;
    if (action === 'back' || action === 'start' || action === 'confirm') {
      hide();
      CT.bus.emit('menu:closed');
    }
    return true;
  }

  CT.menu = {
    show,
    hide,
    handle,
    get open() {
      return open;
    },
  };
})();
