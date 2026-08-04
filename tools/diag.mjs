// Diagnostic only: mirrors src/spatial.js collect() in the page's main world so
// we can see exactly which elements the focus engine is choosing between.
import { connect } from './cdp.mjs';

const CODE = `(() => {
  const CANDIDATES = ['a[href]','button','[role="button"]','[role="link"]','[role="tab"]','[role="option"]','[role="checkbox"]','[role="menuitem"]','yt-chip-cloud-chip-renderer','tp-yt-paper-item','[tabindex="0"]'].join(',');
  const CARDS = ['ytd-rich-item-renderer','ytd-video-renderer','ytd-compact-video-renderer','ytd-grid-video-renderer','ytd-playlist-renderer','ytd-radio-renderer','ytd-channel-renderer','ytd-reel-item-renderer','ytd-rich-grid-slim-media','ytd-guide-entry-renderer','ytd-mini-guide-entry-renderer','ytd-comment-thread-renderer'].join(',');
  const EXCLUDE = ['#couchtube-root','.ytp-chrome-bottom','.ytp-chrome-top','#movie_player','tp-yt-iron-overlay-backdrop'].join(',');

  function visible(el){
    const s = getComputedStyle(el);
    if (s.visibility==='hidden'||s.display==='none') return false;
    if (parseFloat(s.opacity) < 0.05) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.hasAttribute('disabled')||el.getAttribute('aria-disabled')==='true') return false;
    return true;
  }

  const vh = innerHeight;
  const raw = document.querySelectorAll(CANDIDATES);
  const byCard = new Map(); const loose = [];
  const rejected = { invisible:0, excluded:0, tiny:0, offband:0 };

  for (const el of raw) {
    if (!visible(el)) { rejected.invisible++; continue; }
    if (el.closest(EXCLUDE)) { rejected.excluded++; continue; }
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.width*r.height < 500) { rejected.tiny++; continue; }
    if (r.bottom < -vh*1.5 || r.top > vh*2.5) { rejected.offband++; continue; }
    const card = el.closest(CARDS);
    const area = r.width*r.height;
    if (card) { const p = byCard.get(card); if(!p||area>p.area) byCard.set(card,{el,rect:r,area}); }
    else loose.push({el,rect:r,area});
  }

  const out = [...byCard.values(), ...loose];
  const kept = out.filter(c => !out.some(o => o!==c && o.el.contains(c.el) && o.area < c.area*4));
  const dropped = out.filter(c => out.some(o => o!==c && o.el.contains(c.el) && o.area < c.area*4));

  const describe = (c) => ({
    tag: c.el.tagName.toLowerCase() + (c.el.id ? '#'+c.el.id : ''),
    card: (c.el.closest(CARDS)||{}).tagName || null,
    x: Math.round(c.rect.x), y: Math.round(c.rect.y),
    w: Math.round(c.rect.width), h: Math.round(c.rect.height),
    text: (c.el.innerText||c.el.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().slice(0,42),
  });

  return {
    totalRaw: raw.length,
    rejected,
    cards: byCard.size,
    loose: loose.length,
    kept: kept.length,
    droppedByNesting: dropped.length,
    videoRenderers: document.querySelectorAll('ytd-video-renderer').length,
    keptSample: kept.sort((a,b)=>a.rect.y-b.rect.y).slice(0,26).map(describe),
    droppedSample: dropped.slice(0,10).map(describe),
  };
})()`;

const session = await connect('youtube.com');
console.log(JSON.stringify(await session.eval(CODE), null, 2));
session.close();
