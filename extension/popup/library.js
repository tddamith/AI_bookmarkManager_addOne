import { api, $, getSession, clearSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { renderTabs } from "./tabs.js";
import { favicon } from "./favicon.js";
import { HIDE, loadHide, stripStash } from "./hide.js";

renderPanelHead($("head"), `<button id="account" type="button" class="avatar" aria-label="Log out" title="Log out">S</button>`);
renderTabs($("tabs"), "library");

const PEEK = 3, MORE = 12;
const ICONS = [["#D4FA1E", "#111111"], ["#111111", "#FFFFFF"], ["#C9B597", "#111111"], ["#FFFFFF", "#111111"], ["#A6C3DD", "#111111"], ["#CFCFCC", "#111111"]];
let marks = [], roots = [], filter = "All", query = "", sort = "recent";
const open = new Map();   // group name -> { collapsed, all }
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

const ago = (t) => { const m = (Date.now() - t) / 6e4; return m < 1 ? "now" : m < 60 ? `${Math.round(m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 10080 ? `${Math.round(m / 1440)}d` : m < 43200 ? `${Math.round(m / 10080)}w` : `${Math.round(m / 43200)}mo`; };
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); n.append(...kids); return n; };
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const otherRoot = () => roots[0].children[1] ?? roots[0].children[0];

function flatten(rs) {
  const out = []; const walk = (n, path) => (n.url ? (!HIDE.has(n.id) && out.push({ ...n, path: stripStash(path) })) : (n.children ?? []).forEach((c) => walk(c, [...path, n.title])));
  rs[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, [])));
  return out;
}
const category = (b) => b.path[0] || "Unsorted";

let toastTimer;
function toast(msg, onUndo) {
  $("toastText").textContent = msg; $("toast").hidden = false; $("undo").hidden = !onUndo;
  $("undo").onclick = onUndo ? async () => { $("toast").hidden = true; await onUndo(); await load(); } : null;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("toast").hidden = true; }, 6000);
}

function paintChips() {
  const counts = new Map(); marks.forEach((b) => counts.set(category(b), (counts.get(category(b)) ?? 0) + 1));
  const names = ["All", ...[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n)];
  if (!names.includes(filter)) filter = "All";
  $("chips").replaceChildren(...names.map((n) => {
    const b = el("button", { type: "button", className: "chip-btn", textContent: n }); b.setAttribute("aria-pressed", n === filter);
    b.onclick = () => { filter = n; paintChips(); paintList(); }; return b;
  }));
}

function paintList() {
  const q = query.toLowerCase();
  const rows = marks.filter((b) => (filter === "All" || category(b) === filter) && (!q || `${b.title} ${b.url} ${b.path.join(" ")}`.toLowerCase().includes(q)));
  const cmp = sort === "name" ? (a, b) => (a.title || a.url).localeCompare(b.title || b.url) : sort === "oldest" ? (a, b) => a.dateAdded - b.dateAdded : (a, b) => b.dateAdded - a.dateAdded;
  $("count").textContent = q ? `${rows.length} result${rows.length === 1 ? "" : "s"}` : `${marks.length.toLocaleString()} saved`;
  const groups = new Map(); rows.forEach((b) => groups.set(category(b), [...(groups.get(category(b)) ?? []), b]));
  const wrap = $("groups"); wrap.replaceChildren();
  if (!rows.length) { wrap.append(el("div", { className: "none", textContent: q ? "No matches. Try different words." : marks.length ? "Nothing in this folder yet." : "Nothing saved yet. Open a page and use Save on Home." })); return; }
  [...groups.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([name, items]) => {
    items.sort(cmp);
    const st = open.get(name) ?? { collapsed: false, all: false }; const idx = hash(name) % ICONS.length;
    const [ibg, ifg] = ICONS[idx];
    const head = el("button", { type: "button", className: "ghead" }); head.dataset.g = name; head.setAttribute("aria-expanded", String(!st.collapsed));
    const gi = el("span", { className: "gico" }); gi.style.background = ibg; if (ibg === "#FFFFFF") gi.style.border = "1px solid #111";
    gi.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="${ifg}"/></svg>`;
    head.append(gi, el("span", { className: "gname", textContent: name }), el("span", { className: "gn", textContent: items.length.toLocaleString() }));
    head.insertAdjacentHTML("beforeend", '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');
    const list = el("ul", { className: "rowlist" }); list.hidden = st.collapsed;
    const expanded = st.all || !!q;
    const ARROW = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
    items.slice(0, expanded ? Math.max(MORE, items.length > 50 ? 50 : items.length) : PEEK).forEach((b) => {
      const h = hostOf(b.url); const tile = favicon(b.url);
      let rest = ""; try { const u = new URL(b.url); rest = (u.pathname + u.search).replace(/^\/$/, ""); } catch {}
      const addr = el("span", { className: "p" }, el("span", { className: "dom", textContent: h }), rest);
      const when = el("span", { className: "w" }); when.insertAdjacentHTML("afterbegin", ARROW); when.append(el("span", { textContent: ago(b.dateAdded) }));
      const a = el("a", { href: b.url, target: "_blank", rel: "noopener", title: b.url }, tile, el("span", { className: "txt" }, el("span", { className: "t", textContent: b.title || b.url }), addr), when);
      list.append(el("li", {}, a));
    });
    head.onclick = () => { open.set(name, { ...st, collapsed: !st.collapsed }); paintList(); [...document.querySelectorAll(".ghead")].find((x) => x.dataset.g === name)?.focus(); };
    const g = el("section", { className: "group" }, head, list);
    if (!st.collapsed && !expanded && items.length > PEEK) { const more = el("button", { type: "button", className: "btn link-btn gmore", textContent: `Show all ${items.length}` }); more.onclick = () => { open.set(name, { ...st, all: true }); paintList(); }; g.append(more); }
    wrap.append(g);
  });
}

async function load() {
  const session = await getSession();
  if (!session) { location.href = "login.html"; return; }
  $("account").textContent = ((session.name || session.email || "S")[0]).toUpperCase();
  await loadHide(); roots = await api.bookmarks.getTree(); marks = flatten(roots);
  paintChips(); paintList();
}

let timer;
$("search").addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(() => { query = e.target.value.trim(); paintList(); }, 150); });
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); query = $("search").value.trim(); paintList(); });
$("sort").addEventListener("change", (e) => { sort = e.target.value; paintList(); });
$("account").addEventListener("click", async () => { await clearSession(); location.href = "login.html"; });

// Drag a link from the page into the panel to save it (into the "Stash" folder).
const drop = document.body;
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragging-over"); });
drop.addEventListener("dragleave", (e) => { if (e.target === drop || !drop.contains(e.relatedTarget)) drop.classList.remove("dragging-over"); });
drop.addEventListener("drop", async (e) => {
  e.preventDefault(); drop.classList.remove("dragging-over");
  const raw = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "").split("\n").find((l) => l && !l.startsWith("#")) ?? "";
  let url; try { url = new URL(raw.trim()); if (!/^https?:$/.test(url.protocol)) throw 0; } catch { toast("That isn't a web link."); return; }
  const kids = await api.bookmarks.getChildren(otherRoot().id);
  const folder = kids.find((k) => !k.url && /^stash$/i.test(k.title)) ?? await api.bookmarks.create({ parentId: otherRoot().id, title: "Stash" });
  const b = await api.bookmarks.create({ parentId: folder.id, title: url.hostname + url.pathname.replace(/\/$/, ""), url: url.href });
  toast("Saved to your stash.", () => api.bookmarks.remove(b.id));
  await load();
});

const initial = new URLSearchParams(location.search).get("q");
if (initial) { $("search").value = initial; query = initial; }
load();
