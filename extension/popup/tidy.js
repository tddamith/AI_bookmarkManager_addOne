import { api, $, getSession, clearSession, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { renderTabs } from "./tabs.js";
import { withBusy } from "./forms.js";
import { HIDE, loadHide, stripStash } from "./hide.js";

renderPanelHead($("head"), `<button id="account" type="button" class="avatar" aria-label="Profile" title="Profile">S</button>`);
renderTabs($("tabs"), "tidy");

const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); n.append(...kids); return n; };
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
const host = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

let roots = [], marks = [], plan = null, dead = [], scanning = null, scanned = false;
const folderPath = new Map();
const on = { dups: true, dead: true, unsorted: true };
let previewing = false;

function flatten(rs) {
  const out = []; folderPath.clear();
  const mark = (n, p) => { if (!n.url) { folderPath.set(n.id, stripStash([...p, n.title]).join(" › ") || n.title); (n.children ?? []).forEach((c) => mark(c, [...p, n.title])); } };
  rs[0].children.forEach((top) => (top.children ?? []).forEach((c) => mark(c, []))); const walk = (n, path) => (n.url ? (!HIDE.has(n.id) && out.push({ ...n, path: stripStash(path) })) : (n.children ?? []).forEach((c) => walk(c, [...path, n.title])));
  rs[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, [])));
  return out;
}
const otherRoot = () => roots[0].children[1] ?? roots[0].children[0];

// ── Analysis ───────────────────────────────────────────────
function analyze() {
  const used = new Set();
  // Duplicates: same page saved more than once → keep the newest copy.
  const groups = new Map();
  marks.forEach((b) => groups.set(normUrl(b.url), [...(groups.get(normUrl(b.url)) ?? []), b]));
  const dupGroups = [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => b.dateAdded - a.dateAdded));
  const dups = dupGroups.flatMap((g) => g.slice(1)); dups.forEach((b) => used.add(b.id));
  // Dead links: from the last scan (needs the optional permission).
  const deadItems = marks.filter((b) => dead.some((d) => d.id === b.id) && !used.has(b.id)); deadItems.forEach((b) => used.add(b.id));
  // Unsorted: loose in a top-level folder; matched to the folder you already use for that site.
  const hostFolder = new Map();
  marks.filter((b) => b.path.length && !used.has(b.id)).forEach((b) => { const h = host(b.url); if (!h) return; const m = hostFolder.get(h) ?? new Map(); m.set(b.parentId, (m.get(b.parentId) ?? 0) + 1); hostFolder.set(h, m); });
  const loose = marks.filter((b) => !b.path.length && !used.has(b.id));
  const target = (b) => [...(hostFolder.get(host(b.url)) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const unsorted = loose.map((b) => ({ b, to: target(b) })).filter((x) => x.to);
  return { dupGroups, dups, deadItems, loose, unsorted };
}

// ── UI ─────────────────────────────────────────────────────
function paint() {
  plan = analyze();
  const rows = [];
  rows.push(cat("dups", plan.dups.length, "duplicate", "Keep the newest copy", plan.dupGroups.map((g) => `· ${g[0].title || host(g[0].url)} — ${g.length} copies`)));
  if (scanning) rows.push(scanRow());
  else if (!scanned) rows.push(deadNotChecked());
  else rows.push(cat("dead", plan.deadItems.length, "dead link", "Move to Archive", plan.deadItems.map((b) => `· ${host(b.url)}${new URL(b.url).pathname.replace(/\/$/, "")} — ${dead.find((d) => d.id === b.id)?.why ?? "dead"}`)));
  rows.push(cat("unsorted", plan.unsorted.length, "unsorted save", "Put into the folder you use for that site", plan.unsorted.map((x) => `· ${x.b.title || host(x.b.url)} → ${path(x.to)}`),
    plan.loose.length > plan.unsorted.length ? `${plan.loose.length - plan.unsorted.length} more have no matching folder yet` : ""));
  $("cats").replaceChildren(...rows);
  const n = total();
  $("fix").textContent = n ? `Fix ${n} item${n === 1 ? "" : "s"}` : "Nothing to fix";
  $("fix").disabled = !n || !!scanning;
  $("summary").textContent = !plan.dups.length && !plan.unsorted.length && !plan.deadItems.length && !scanning ? "Your library is tidy. Nice." : "";
}
const path = (id) => folderPath.get(id) || "a folder";
function total() { return (on.dups ? plan.dups.length : 0) + (on.dead ? plan.deadItems.length : 0) + (on.unsorted ? plan.unsorted.length : 0); }

function cat(key, count, noun, note, details, extra = "") {
  const li = el("li", { className: "cat" + (count ? "" : " empty") });
  const cb = el("input", { type: "checkbox", checked: !!count && on[key], disabled: !count }); cb.setAttribute("aria-label", plural(count, noun));
  cb.onchange = () => { on[key] = cb.checked; paintTotals(); };
  li.append(el("div", { className: "row" }, el("div", {}, el("div", { className: "name", textContent: plural(count, noun) }), el("div", { className: "sub", textContent: count ? note : "Nothing to fix" })), cb));
  details.slice(0, previewing ? 12 : 2).forEach((d) => li.append(el("div", { className: "detail", textContent: d })));
  if (previewing && details.length > 12) li.append(el("div", { className: "detail", textContent: `…and ${details.length - 12} more` }));
  if (extra) li.append(el("div", { className: "detail", textContent: "· " + extra }));
  return li;
}
function paintTotals() { const n = total(); $("fix").textContent = n ? `Fix ${n} item${n === 1 ? "" : "s"}` : "Nothing to fix"; $("fix").disabled = !n; }

function deadNotChecked() {
  const li = el("li", { className: "cat" });
  const b = el("button", { type: "button", className: "btn sm outline scan", textContent: "Check links" });
  b.onclick = () => scanLinks(b);
  li.append(el("div", { className: "row" }, el("div", {}, el("div", { className: "name", textContent: "Dead links" }), el("div", { className: "sub", textContent: "Not checked yet" }))), b,
    el("div", { className: "detail", textContent: "Checking visits each saved page once. Stash asks your browser for permission first." }));
  return li;
}
function scanRow() {
  const li = el("li", { className: "cat" });
  li.append(el("div", { className: "row" }, el("div", {}, el("div", { className: "name", textContent: "Checking links…" }), el("div", { className: "sub", id: "scanText", textContent: `${scanning.done} of ${scanning.total}` }))),
    el("div", { className: "progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": scanning.total }, el("div", { id: "scanBar", style: `width:${scanning.total ? (scanning.done / scanning.total) * 100 : 0}%` })));
  return li;
}

// ── Dead-link scan (optional host permission, asked on click) ─
async function scanLinks(btn) {
  let ok = false; try { ok = await api.permissions.request({ origins: ["<all_urls>"] }); } catch {}
  if (!ok) { $("summary").textContent = "Dead-link checking needs permission to visit your saved pages. Nothing was checked."; return; }
  const urls = marks.filter((b) => /^https?:/.test(b.url)).slice(0, 2000);
  scanning = { done: 0, total: urls.length }; dead = []; paint();
  const queue = [...urls];
  const check = async (b) => {
    const tryFetch = async (method) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000); try { const r = await fetch(b.url, { method, redirect: "follow", signal: c.signal, cache: "no-store" }); r.body?.cancel?.(); return r.status; } finally { clearTimeout(t); } };
    try { let s = await tryFetch("HEAD"); if ([403, 405, 501].includes(s)) s = await tryFetch("GET"); if (s === 404 || s === 410) dead.push({ id: b.id, why: String(s) }); }
    catch { if (navigator.onLine) dead.push({ id: b.id, why: "unreachable" }); }
    scanning.done++; $("scanText") && ($("scanText").textContent = `${scanning.done} of ${scanning.total}`); $("scanBar") && ($("scanBar").style.width = `${(scanning.done / scanning.total) * 100}%`);
  };
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await check(queue.shift()); }));
  scanning = null; scanned = true; on.dead = true; await api.storage.local.set({ deadScan: { at: Date.now(), items: dead } }); paint();
}

// ── Fix + undo ─────────────────────────────────────────────
async function archiveFolder() {
  const kids = await api.bookmarks.getChildren(otherRoot().id);
  return kids.find((k) => !k.url && /^archive$/i.test(k.title)) ?? api.bookmarks.create({ parentId: otherRoot().id, title: "Archive" });
}
async function fix() {
  const log = [];
  if (on.dups) for (const b of plan.dups) { log.push({ t: "remove", n: { parentId: b.parentId, index: b.index, title: b.title, url: b.url } }); await api.bookmarks.remove(b.id); }
  if (on.dead && plan.deadItems.length) { const arch = await archiveFolder(); for (const b of plan.deadItems) { log.push({ t: "move", id: b.id, parentId: b.parentId, index: b.index }); await api.bookmarks.move(b.id, { parentId: arch.id }); } }
  if (on.unsorted) for (const { b, to } of plan.unsorted) { log.push({ t: "move", id: b.id, parentId: b.parentId, index: b.index }); await api.bookmarks.move(b.id, { parentId: to }); }
  await api.storage.local.set({ tidyUndo: { at: Date.now(), log }, tidyDone: Date.now() });
  $("summary").textContent = `Done. ${plural(log.length, "change")} made.`;
  await load(); paintUndo();
}
async function undo() {
  const { tidyUndo } = await api.storage.local.get("tidyUndo"); if (!tidyUndo) return;
  for (const op of [...tidyUndo.log].reverse()) { try { op.t === "remove" ? await api.bookmarks.create(op.n) : await api.bookmarks.move(op.id, { parentId: op.parentId, index: op.index }); } catch {} }
  await api.storage.local.remove("tidyUndo"); dead = []; $("summary").textContent = "Undone. Your library is back as it was."; await load(); paintUndo();
}
async function paintUndo() {
  const { tidyUndo } = await api.storage.local.get("tidyUndo");
  $("undo").hidden = !tidyUndo; $("undoText").textContent = tidyUndo ? `Last tidy-up: ${plural(tidyUndo.log.length, "change")}.` : "You can undo any time.";
}

async function load() {
  const session = await getSession();
  if (!session) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;
  $("account").textContent = ((session.name || session.email || "S")[0]).toUpperCase();
  await loadHide(); roots = await api.bookmarks.getTree(); marks = flatten(roots);
  if (!scanning) { const { deadScan } = await api.storage.local.get("deadScan"); scanned = !!deadScan; dead = deadScan?.items ?? []; }
  paint();
}
$("fix").onclick = (e) => withBusy(e.currentTarget, fix);
$("undo").onclick = (e) => withBusy(e.currentTarget, undo);
$("preview").onclick = (e) => { previewing = !previewing; e.currentTarget.setAttribute("aria-pressed", previewing); e.currentTarget.textContent = previewing ? "Hide preview" : "Preview"; paint(); };
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); const q = $("search").value.trim(); location.href = "library.html" + (q ? `?q=${encodeURIComponent(q)}` : ""); });
$("account").addEventListener("click", () => { location.href = "profile.html"; });
load().then(paintUndo);
