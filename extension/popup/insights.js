import { api, $, getSession, clearSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { renderTabs } from "./tabs.js";
import { withBusy } from "./forms.js";
import { favicon } from "./favicon.js";
import { HIDE, loadHide, stripStash } from "./hide.js";

renderPanelHead($("head"), `<button id="account" type="button" class="avatar" aria-label="Log out" title="Log out">S</button>`, { back: "home.html" });
renderTabs($("tabs"), "home");

const DAY = 864e5;
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); n.append(...kids); return n; };
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const day = (t) => new Date(t).toDateString();
let range = "week", roots = [];

function flatten(rs) {
  const out = []; const walk = (n, path) => (n.url ? (!HIDE.has(n.id) && out.push({ ...n, path: stripStash(path) })) : (n.children ?? []).forEach((c) => walk(c, [...path, n.title])));
  rs[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, [])));
  return out;
}
const otherRoot = () => roots[0].children[1] ?? roots[0].children[0];
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
  await loadHide(); roots = await api.bookmarks.getTree(); const marks = flatten(roots);
  const byUrl = new Map(marks.map((b) => [normUrl(b.url), b]));
  const { visits = [], trackingSince = Date.now(), pins = [] } = await api.storage.local.get(["visits", "trackingSince", "pins"]);
  const since = Date.now() - (range === "week" ? 7 : 30) * DAY;
  const vs = visits.filter((v) => v.t > since && byUrl.has(v.u)).map((v) => ({ ...v, b: byUrl.get(v.u) }));
  const rangeWord = range === "week" ? "this week" : "this month";

  $("since").textContent = `Counts opens of pages you've saved, on this device only. Tracking since ${new Date(trackingSince).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`;
  ["chartSec", "topSec", "aiSec", "empty"].forEach((id) => ($(id).hidden = true));

  if (!vs.length) {
    $("h1").textContent = `No visits ${rangeWord}`; $("visits").textContent = "0 visits to saved pages —";
    $("empty").hidden = false; $("empty").textContent = marks.length ? "Open some of your saved pages and Stash will chart where your time goes." : "Save a few pages first. Then open them again and insights will appear here.";
    return;
  }
  // Categories = top-level folder of each saved page.
  const cat = (b) => b.path[0] || "Unsorted";
  const counts = new Map(); vs.forEach((v) => counts.set(cat(v.b), (counts.get(cat(v.b)) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("h1").replaceChildren("You live in ", el("mark", { textContent: top[0][0] }), ` ${rangeWord}`);
  $("visits").textContent = `${vs.length} visit${vs.length === 1 ? "" : "s"} to saved pages —`;
  $("chartSec").hidden = false;
  const bars = $("bars"); bars.replaceChildren();
  top.forEach(([n, c], i) => bars.append(el("div", { className: "bar" + (i ? "" : " first") }, el("span", { textContent: n }), el("div", { className: "track" }, el("div", { className: "fill", style: `width:${Math.round((c / top[0][1]) * 100)}%` })), el("span", { className: "pct", textContent: Math.round((c / vs.length) * 100) + "%" }))));
  bars.setAttribute("aria-label", "Most visited categories: " + top.map(([n, c]) => `${n} ${Math.round((c / vs.length) * 100)}%`).join(", "));

  // Most opened pages.
  const pages = new Map(); vs.forEach((v) => pages.set(v.u, { b: v.b, n: (pages.get(v.u)?.n ?? 0) + 1 }));
  const ranked = [...pages.values()].sort((a, b) => b.n - a.n);
  $("topSec").hidden = false;
  $("top").replaceChildren(...ranked.slice(0, 2).map((p, i) => { const a = el("a", { href: p.b.url, target: "_blank", rel: "noopener" }, el("span", { className: "n", textContent: String(i + 1).padStart(2, "0") }), favicon(p.b.url, { small: true }), el("span", { className: "t", textContent: p.b.title || p.b.url }), el("span", { className: "c", textContent: `${p.n}×` })); return el("li", {}, a); }));

  // Suggestions: pin a page you open on 3+ days; group a site saved in several places.
  const tips = [];
  const days = new Map(); vs.forEach((v) => days.set(v.u, new Set([...(days.get(v.u) ?? []), day(v.t)])));
  const habit = ranked.find((p) => (days.get(normUrl(p.b.url))?.size ?? 0) >= 3 && !pins.includes(p.b.id));
  if (habit) tips.push({ text: `You open ${host(habit.b.url) || habit.b.title} often. Pin it to Home?`, note: "", action: "Pin", run: async () => { await api.storage.local.set({ pins: [...pins, habit.b.id] }); toast("Pinned to Home.", async () => api.storage.local.set({ pins })); } });
  const hostGroups = new Map(); marks.forEach((b) => { const h = host(b.url); if (h) hostGroups.set(h, [...(hostGroups.get(h) ?? []), b]); });
  const grp = [...hostGroups.entries()].filter(([, g]) => g.length >= 4 && new Set(g.map((b) => b.parentId)).size > 1).sort((a, b) => b[1].length - a[1].length)[0];
  if (grp) tips.push({ text: `Group ${grp[1].length} ${grp[0]} pages?`, note: `Into “${grp[0]}”`, action: "Create", run: async () => {
    const f = await api.bookmarks.create({ parentId: otherRoot().id, title: grp[0] });
    const prev = grp[1].map((b) => ({ id: b.id, parentId: b.parentId, index: b.index }));
    for (const b of grp[1]) await api.bookmarks.move(b.id, { parentId: f.id });
    toast(`Grouped ${prev.length} pages.`, async () => { for (const p of prev) await api.bookmarks.move(p.id, { parentId: p.parentId, index: p.index }); await api.bookmarks.remove(f.id); });
  } });
  if (tips.length) {
    $("aiSec").hidden = false;
    $("tips").replaceChildren(...tips.map((t) => { const btn = el("button", { type: "button", className: "btn sm solid", textContent: t.action }); btn.onclick = (e) => withBusy(e.currentTarget, async () => { await t.run(); await paint(); });
      return el("li", {}, el("div", { className: "txt" }, el("span", { textContent: t.text }), ...(t.note ? [el("small", { textContent: t.note })] : [])), btn); }));
  }
}

const setRange = (r) => { range = r; $("week").setAttribute("aria-pressed", r === "week"); $("month").setAttribute("aria-pressed", r === "month"); paint(); };
$("week").onclick = () => setRange("week"); $("month").onclick = () => setRange("month");
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); const q = $("search").value.trim(); location.href = "library.html" + (q ? `?q=${encodeURIComponent(q)}` : ""); });
$("account").addEventListener("click", async () => { await clearSession(); location.href = "login.html"; });
paint();
