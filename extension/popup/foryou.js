import { api, $, getSession, clearSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { renderTabs } from "./tabs.js";
import { withBusy } from "./forms.js";
import { keywords } from "./topic.js";
import { favicon } from "./favicon.js";
import { HIDE, loadHide, stripStash } from "./hide.js";

renderPanelHead($("head"), `<button id="account" type="button" class="avatar" aria-label="Profile" title="Profile">S</button>`);
renderTabs($("tabs"), "foryou");

const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); n.append(...kids); return n; };
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const ago = (t) => { const d = (Date.now() - t) / 864e5; return d < 1 ? "today" : d < 2 ? "yesterday" : d < 14 ? `${Math.round(d)} days ago` : d < 60 ? `${Math.round(d / 7)} weeks ago` : `${Math.round(d / 30)} months ago`; };
const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0"><path d="M7 17L17 7M9 7h8v8"/></svg>';
const PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

function flatten(rs) {
  const out = []; const walk = (n, path) => (n.url ? (!HIDE.has(n.id) && out.push({ ...n, path: stripStash(path) })) : (n.children ?? []).forEach((c) => walk(c, [...path, n.title])));
  rs[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, [])));
  return out;
}
let toastTimer;
function toast(msg, onUndo) {
  $("toastText").textContent = msg; $("toast").hidden = false; $("undo").hidden = !onUndo;
  $("undo").onclick = onUndo ? async () => { $("toast").hidden = true; await onUndo(); paint(); } : null;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("toast").hidden = true; }, 6000);
}

async function paint() {
  const session = await getSession();
  if (!session) { location.href = "login.html"; return; }
  $("account").textContent = ((session.name || session.email || "S")[0]).toUpperCase();
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const h = host(tab?.url ?? "");
  ["about", "libSec", "siteSec", "empty"].forEach((id) => ($(id).hidden = true));
  if (!h || !/^https?:/.test(tab.url)) {
    $("kicker").textContent = "Picked for this page"; $("h1").textContent = "More like this";
    $("empty").hidden = false; $("empty").textContent = "Open a web page and Stash will show related saves and sites here."; return;
  }
  $("kicker").textContent = `${h} — Picked for this page`;
  await loadHide(); const roots = await api.bookmarks.getTree(); const marks = flatten(roots);
  const here = marks.find((b) => normUrl(b.url) === normUrl(tab.url));

  $("about").hidden = false; const at = $("aboutText"); at.replaceChildren();
  if (here) at.textContent = `Saved ${ago(here.dateAdded)}${here.path.length ? " in " + here.path.join(" › ") : ""}.`;
  else at.append("You haven't saved this page yet. ", el("a", { href: "save.html", textContent: "Save it" }), " to build your library.");

  // Related saves: shared keywords in title / URL / folder, plus same site.
  const kw = keywords(tab.title, tab.url);
  const scored = marks.filter((b) => normUrl(b.url) !== normUrl(tab.url)).map((b) => {
    const bk = keywords(b.title, b.url); for (const p of b.path) p.toLowerCase().split(/[\s›]+/).forEach((s) => s.length > 2 && bk.set(s, 1));
    let s = 0; kw.forEach((wt, k) => { if (bk.has(k)) s += wt; }); if (host(b.url) === h) s += 1;
    return { b, s };
  }).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s || b.b.dateAdded - a.b.dateAdded);

  const lib = scored.slice(0, 3);
  if (lib.length) {
    $("libSec").hidden = false;
    $("lib").replaceChildren(...lib.map(({ b }) => { const a = el("a", { href: b.url, target: "_blank", rel: "noopener" }); a.append(favicon(b.url, { small: true }), el("div", { className: "txt" }, el("span", { className: "t", textContent: b.title || b.url }), el("span", { className: "p", textContent: b.path.length ? b.path.join(" › ") : "Unsorted" }))); a.insertAdjacentHTML("beforeend", ARROW); return el("li", {}, a); }));
  }

  // Sites you keep returning to for this topic (from related saves), not yet saved at their home page.
  const byHost = new Map();
  scored.forEach(({ b }) => { const x = host(b.url); if (x && x !== h) { const e = byHost.get(x) ?? { n: 0, parent: b.parentId, title: x }; e.n++; byHost.set(x, e); } });
  const sites = [...byHost.entries()].filter(([x]) => !marks.some((b) => host(b.url) === x && new URL(b.url).pathname === "/")).sort((a, b) => b[1].n - a[1].n).slice(0, 3);
  if (sites.length) {
    $("siteSec").hidden = false;
    $("sites").replaceChildren(...sites.map(([x, e]) => {
      const btn = el("button", { type: "button", className: "btn icon-round", ariaLabel: `Save ${x}` }); btn.setAttribute("aria-label", `Save ${x}`); btn.innerHTML = PLUS;
      btn.onclick = () => withBusy(btn, async () => { const b = await api.bookmarks.create({ parentId: e.parent, title: x, url: `https://${x}/` }); toast(`Saved ${x}.`, () => api.bookmarks.remove(b.id)); await paint(); });
      return el("li", { className: "site" }, favicon(`https://${x}/`, { small: true }), el("div", { className: "txt" }, el("span", { className: "t", textContent: x }), el("span", { className: "p", textContent: `${e.n} related save${e.n === 1 ? "" : "s"} in your library` })), btn);
    }));
  }
  if (!lib.length && !sites.length) { $("empty").hidden = false; $("empty").textContent = "Nothing related in your library yet. Save a few pages on this topic and picks will appear here."; }
}

api.tabs.onActivated.addListener(paint);
api.tabs.onUpdated.addListener((_i, info) => { if (info.url || info.status === "complete") paint(); });
api.bookmarks.onCreated.addListener(paint); api.bookmarks.onRemoved.addListener(paint);
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); const q = $("search").value.trim(); location.href = "library.html" + (q ? `?q=${encodeURIComponent(q)}` : ""); });
$("account").addEventListener("click", () => { location.href = "profile.html"; });
paint();
