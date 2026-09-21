// Geometry-based focus movement. Given the thing you are on and a direction,
// pick the element a human would say is "the next one over".
(function () {
  // Broad on purpose. Both sites rename their components constantly, so leaning
  // on roles and real anchors survives their redesigns better than tag names.
  const CANDIDATES = [
    'a[href]',
    'button',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="checkbox"]',
    '[role="menuitem"]',
    'yt-chip-cloud-chip-renderer',
    'tp-yt-paper-item',
    '[tabindex="0"]',
  ].join(',');

  // Which wrappers count as one tile, and what to stay out of, both come from
  // the adapter. Ours is the only entry every site shares.
  const ALWAYS_EXCLUDE = ['#couchtube-root', '[inert]'];

  function cards() {
    const list = (CT.site && CT.site.cards) || [];
    return list.length ? list.join(',') : null;
  }

  function exclude() {
    return ALWAYS_EXCLUDE.concat((CT.site && CT.site.exclude) || []).join(',');
  }

  // How far outside the viewport we still consider things, in viewport
  // multiples. Sites with paginated rows clamp this so focus cannot walk onto a
  // card that is sitting in the DOM but clipped off screen.
  const OPEN_BAND = { top: -1.5, bottom: 2.5, left: -Infinity, right: Infinity };

  function band() {
    return (CT.site && CT.site.band) || OPEN_BAND;
  }

  function usable(el) {
    if (!CT.isVisible(el)) return false;
    // An aria-hidden element is fine to focus, but one inside a genuinely
    // inert subtree is not, and neither is our own overlay.
    if (el.closest(exclude())) return false;
    const r = CT.rectOf(el);
    if (!r) return false;
    if (r.width * r.height < 500) return false;
    return true;
  }

  function collect() {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const b = band();
    const cardSel = cards();
    const raw = document.querySelectorAll(CANDIDATES);
    const byCard = new Map();
    const loose = [];

    for (const el of raw) {
      if (!usable(el)) continue;
      const r = el.getBoundingClientRect();
      // Keep a generous band around the viewport so you can navigate past the
      // fold without walking the entire lazy-rendered document.
      if (r.bottom < vh * b.top || r.top > vh * b.bottom) continue;
      if (r.right < vw * b.left || r.left > vw * b.right) continue;

      const card = cardSel ? el.closest(cardSel) : null;
      if (card) {
        const prev = byCard.get(card);
        const area = r.width * r.height;
        if (!prev || area > prev.area) byCard.set(card, { el, rect: r, area });
      } else {
        loose.push({ el, rect: r, area: r.width * r.height });
      }
    }

    const out = [...byCard.values(), ...loose];
    // Drop anything fully wrapped by another candidate, keeps the ring tight.
    return out.filter((c) => !out.some((o) => o !== c && o.el.contains(c.el) && o.area < c.area * 4));
  }

  function overlap(aMin, aMax, bMin, bMax) {
    return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  }

  function score(from, to, dir) {
    const horizontal = dir === 'left' || dir === 'right';

    let primary;
    if (dir === 'down') primary = to.top - from.bottom;
    else if (dir === 'up') primary = from.top - to.bottom;
    else if (dir === 'right') primary = to.left - from.right;
    else primary = from.left - to.right;

    // Must actually be in that direction. A little tolerance lets you move
    // between items that are only slightly staggered.
    const tolerance = horizontal ? -from.width * 0.35 : -from.height * 0.35;
    if (primary < tolerance) return Infinity;
    primary = Math.max(primary, 0);

    const cross = horizontal
      ? overlap(from.top, from.bottom, to.top, to.bottom)
      : overlap(from.left, from.right, to.left, to.right);

    const span = horizontal ? Math.min(from.height, to.height) : Math.min(from.width, to.width);

    if (cross > 0) {
      // Same row / same column: reward alignment heavily.
      return primary + (1 - cross / Math.max(span, 1)) * 120;
    }

    // Nothing lines up, fall back to how far off-axis it is plus a flat penalty
    // so an aligned-but-distant item still wins.
    const gap = horizontal
      ? Math.max(from.top - to.bottom, to.top - from.bottom)
      : Math.max(from.left - to.right, to.left - from.right);
    return primary + Math.max(gap, 0) * 2.5 + 500;
  }

  function next(current, dir) {
    const items = collect();
    if (!items.length) return null;

    const fromRect = current && current.isConnected ? CT.rectOf(current) : null;
    if (!fromRect) {
      // No anchor yet: grab whatever sits nearest the top-left of the viewport.
      let best = null;
      let bestScore = Infinity;
      for (const item of items) {
        const s = Math.abs(item.rect.top) + item.rect.left * 0.35;
        if (s < bestScore) {
          bestScore = s;
          best = item.el;
        }
      }
      return best;
    }

    let best = null;
    let bestScore = Infinity;
    for (const item of items) {
      if (item.el === current || item.el.contains(current) || current.contains(item.el)) continue;
      const s = score(fromRect, item.rect, dir);
      if (s < bestScore) {
        bestScore = s;
        best = item.el;
      }
    }
    return best;
  }

  function first() {
    return next(null, 'down');
  }

  // Same geometry, but over a list you supply. The on-screen keyboard uses this
  // for its own grid since shadow DOM nodes never show up in collect().
  function pickFrom(fromEl, list, dir) {
    const fromRect = CT.rectOf(fromEl);
    if (!fromRect) return list[0] || null;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === fromEl) continue;
      const r = CT.rectOf(el);
      if (!r) continue;
      const s = score(fromRect, r, dir);
      if (s < bestScore) {
        bestScore = s;
        best = el;
      }
    }
    return best;
  }

  CT.spatial = { next, first, collect, pickFrom, score };
})();
