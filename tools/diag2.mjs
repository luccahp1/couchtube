// Diagnostic only: for each search result card, show every focusable inside it
// and the exact reason the collector kept or dropped it.
import { connect } from './cdp.mjs';

const CODE = `(() => {
  const CANDIDATES = ['a[href]','button','[role="button"]','[role="link"]','[role="tab"]','[role="option"]','[role="checkbox"]','[role="menuitem"]','yt-chip-cloud-chip-renderer','tp-yt-paper-item','[tabindex="0"]'].join(',');
  const vh = innerHeight;
  const out = [];
  const cards = [...document.querySelectorAll('ytd-video-renderer')].slice(0, 6);
  for (const card of cards) {
    const cr = card.getBoundingClientRect();
    const inner = [...card.querySelectorAll(CANDIDATES)].map(el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      let why = 'kept';
      if (s.visibility==='hidden'||s.display==='none') why='display/visibility';
      else if (parseFloat(s.opacity) < 0.05) why='opacity ' + s.opacity;
      else if (el.closest('[aria-hidden="true"]')) why='aria-hidden ancestor';
      else if (el.hasAttribute('disabled')||el.getAttribute('aria-disabled')==='true') why='disabled';
      else if (r.width < 8 || r.height < 8) why='too small';
      else if (r.width*r.height < 500) why='area<500';
      else if (r.bottom < -vh*1.5 || r.top > vh*2.5) why='off band';
      return { tag: el.tagName.toLowerCase()+(el.id?'#'+el.id:''), w:Math.round(r.width), h:Math.round(r.height), y:Math.round(r.y), why };
    });
    out.push({ cardY: Math.round(cr.y), cardH: Math.round(cr.height), inner });
  }
  return { vh, innerHeight, scrollY, band: vh*2.5, cards: out };
})()`;

const session = await connect('youtube.com');
console.log(JSON.stringify(await session.eval(CODE), null, 2));
session.close();
