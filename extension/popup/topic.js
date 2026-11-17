const STOP = new Set("the and for with from your you are this that what how why when into about guide complete using use best top new www com org net http https html page pages vs which".split(" "));
/** Keyword set from a page title + URL (weighted by where they appear). */
export function keywords(title, url) {
  const w = new Map();
  const add = (s, wt) => { s = s.toLowerCase().replace(/[^a-z0-9]/g, ""); if (s.length > 2 && !STOP.has(s) && !/^\d+$/.test(s)) w.set(s, Math.max(w.get(s) ?? 0, wt)); };
  (title || "").split(/[\s\-–—|:·,.()]+/).forEach((s) => add(s, 2));
  try { const u = new URL(url); u.pathname.split(/[\/\-_.]+/).forEach((s) => add(s, 1)); } catch {}
  return w;
}
