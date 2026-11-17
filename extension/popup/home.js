import { api, $, getSession, clearSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { renderTabs } from "./tabs.js";
import { withBusy } from "./forms.js";
import { favicon } from "./favicon.js";
import { HIDE, loadHide, stripStash } from "./hide.js";

renderPanelHead($("head"), `<button id="account" type="button" class="avatar" aria-label="Log out" title="Log out">S</button>`);
renderTabs($("tabs"), "home");

const DAY = 864e5;
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); n.append(...kids); return n; };

/** Flat list of saved pages with their folder and top-level root. */
function flatten(roots) {
  const out = [];
  const walk = (n, folder, top) => (n.url ? (!HIDE.has(n.id) && out.push({ ...n, folder, top })) : (n.children ?? []).forEach((c) => walk(c, n, top)));
  roots[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, top, top)));
  return out;
}
const otherRoot = (roots) => roots[0].children[1] ?? roots[0].children[0];

let toastTimer;
function toast(msg, onUndo) {
  $("toastText").textContent = msg; $("toast").hidden = false; $("undo").hidden = !onUndo;
  $("undo").onclick = onUndo ? async () => { $("toast").hidden = true; await onUndo(); load(); } : null;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("toast").hidden = true; }, 8000);
}

// ── On this page ───────────────────────────────────────────
let tab = null, marks = [], roots = [];
async function folderNamed(re, create) {
  const found = (function find(n) { if (!n.url && re.test(n.title)) return n; for (const c of n.children ?? []) { const r = find(c); if (r) return r; } })(roots[0]);
  if (found) return found;
  return api.bookmarks.create({ parentId: otherRoot(roots).id, title: create });
}
function suggestFolder(host) {
  const counts = new Map();
  marks.filter((b) => { try { return new URL(b.url).hostname === host; } catch { return false; } })
       .forEach((b) => b.folder && b.folder !== b.top && counts.set(b.folder, (counts.get(b.folder) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
async function paintPage() {
  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  let host = ""; try { const u = new URL(tab?.url ?? ""); if (/^https?:$/.test(u.protocol)) host = u.hostname; } catch {}
  $("pageHost").textContent = host;
  $("pageIcon").replaceChildren(...(host ? [favicon(tab.url, { small: true })] : []));
  $("pageTitle").textContent = host ? (tab.title || host) : "Open a web page to save it";
    const dup = host && marks.find((b) => normUrl(b.url) === normUrl(tab.url));
  const sug = host ? suggestFolder(host) : null;
  $("pageFolder").textContent = host ? `Folder — ${dup?.folder?.title ?? sug?.title ?? "Stash"}` : "";
  $("save").textContent = dup ? "Saved" : "Save page"; $("save").disabled = !host || !!dup;
  $("later").disabled = !host || !!dup;
}
// "Save page" opens the Save page screen (folder, tags, note, reminder).
$("save").onclick = () => { location.href = "save.html"; };
$("later").onclick = (e) => withBusy(e.currentTarget, async () => {
  const f = await folderNamed(/read\s*later/i, "Read later");
  const b = await api.bookmarks.create({ parentId: f.id, title: tab.title, url: tab.url });
  toast("Added to Read later.", () => api.bookmarks.remove(b.id));
  await load();
});
api.tabs.onActivated.addListener(paintPage);
api.tabs.onUpdated.addListener((_i, info) => { if (info.url || info.status === "complete") paintPage(); });

// ── Stats, suggestions, chart ──────────────────────────────
async function load() {
  const session = await getSession();
  if (!session) { location.href = "login.html"; return; }
  if (session.isNew) { location.href = "welcome.html"; return; }
  const name = session.name || session.email || "";
  $("account").textContent = (name[0] || "S").toUpperCase();

  await loadHide(); roots = await api.bookmarks.getTree(); marks = flatten(roots);
  $("sSaved").textContent = marks.length.toLocaleString();
  $("sWeek").textContent = marks.filter((b) => b.dateAdded > Date.now() - 7 * DAY).length;
  const later = marks.filter((b) => /read\s*later/i.test(b.folder?.title ?? ""));
  $("sLater").textContent = later.length;

  const groups = new Map();
  marks.forEach((b) => { const k = normUrl(b.url); groups.set(k, [...(groups.get(k) ?? []), b]); });
  const extras = [...groups.values()].filter((g) => g.length > 1).flatMap((g) => g.sort((a, b) => a.dateAdded - b.dateAdded).slice(1));
  const loose = marks.filter((b) => b.folder === b.top && /other|unsorted/i.test(b.top?.title ?? ""));
  const tips = [];
  if (extras.length) tips.push({ title: `Merge ${extras.length} duplicate${extras.length > 1 ? "s" : ""}`, note: "Same pages saved twice", action: "Merge", run: () => merge(extras) });
  if (loose.length) tips.push({ title: `Sort ${loose.length} unsorted save${loose.length > 1 ? "s" : ""}`, note: "AI folder picks arrive with Tidy", action: "Move", run: () => toast("Sorting arrives with Tidy.") });
  if (later.length >= 3) tips.push({ title: "Read later is piling up", note: `${later.length} saved pages waiting`, action: "Open", run: () => api.tabs.create({ url: later[0].url }) });
  const ul = $("tips"); ul.replaceChildren();
  if (!tips.length) ul.append(el("li", { className: "none", textContent: "All tidy. Nothing to suggest right now." }));
  tips.slice(0, 2).forEach((t) => {
    const btn = el("button", { type: "button", className: "btn sm solid", textContent: t.action });
    btn.onclick = (e) => withBusy(e.currentTarget, async () => t.run());
    ul.append(el("li", {}, el("div", { className: "txt" }, el("span", { textContent: t.title }), el("small", { textContent: t.note })), btn));
  });

  // Chart: share of saves by folder (visit tracking arrives with Insights).
  const byFolder = new Map();
  marks.forEach((b) => { const n = b.folder?.title || "Other"; byFolder.set(n, (byFolder.get(n) ?? 0) + 1); });
  const top = [...byFolder.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const bars = $("bars"); bars.replaceChildren();
  if (!top.length) bars.append(el("div", { className: "none-note", textContent: "Save a few pages to see your folders here." }));
  top.forEach(([n, c], i) => {
    const pct = Math.round((c / marks.length) * 100);
    bars.append(el("div", { className: "bar" + (i ? "" : " first") }, el("span", { textContent: n }), el("div", { className: "track" }, el("div", { className: "fill", style: `width:${Math.round((c / top[0][1]) * 100)}%` })), el("span", { className: "pct", textContent: pct + "%" })));
  });
  bars.setAttribute("aria-label", "Biggest folders: " + top.map(([n, c]) => `${n} ${Math.round((c / marks.length) * 100)}%`).join(", "));
  const { pins = [] } = await api.storage.local.get("pins");
  const pinned = pins.map((id) => marks.find((b) => b.id === id)).filter(Boolean);
  $("pinSec").hidden = !pinned.length;
  $("pins").replaceChildren(...pinned.map((b) => el("li", {}, el("a", { href: b.url, target: "_blank", rel: "noopener", title: b.url }, favicon(b.url, { small: true }), el("span", { textContent: b.title || b.url })))));
  await paintStart(session, marks);
  paintPage();
}

// ── Getting started (after onboarding) ─────────────────────
async function paintStart(session, marks) {
  const { gs, tidyDone } = await api.storage.local.get(["gs", "tidyDone"]);
  const on = !!gs?.on && !gs.dismissed;
  const savedFirst = on && marks.some((b) => b.dateAdded > gs.at);
  const tidied = on && !!tidyDone && tidyDone > gs.at;
  const done = on ? 1 + (savedFirst ? 1 : 0) + (tidied ? 1 : 0) : 0;
  $("gs").hidden = !on;
  $("coach").hidden = !(on && !savedFirst);
  $("pageCard").classList.toggle("spot", on && !savedFirst);
  $("emptyNote").hidden = !(on && !marks.length);
  if (!on) return;
  $("gsCount").textContent = `${done} of 3`;
  [...$("gsBars").children].forEach((bar, i) => { bar.className = i < done ? "on" : ""; });
  $("gsNext").replaceChildren(done === 1 ? "Next: save your first page" : done === 2 ? "Next: " : "You're all set. Nice work.");
  if (done === 2) $("gsNext").append(Object.assign(document.createElement("a"), { href: "tidy.html", textContent: "run a tidy-up" }));
  $("gsHide").textContent = done === 3 ? "Done" : "Hide";
  $("gsHide").onclick = async () => { await api.storage.local.set({ gs: { ...gs, dismissed: true } }); await paintStart(session, marks); };
}

async function merge(extras) {
  const removed = extras.map(({ title, url, parentId, index }) => ({ title, url, parentId, index }));
  for (const b of extras) await api.bookmarks.remove(b.id);
  toast(`Merged ${removed.length} duplicate${removed.length > 1 ? "s" : ""}.`, async () => { for (const r of removed) await api.bookmarks.create(r); });
  await load();
}

// Search → Library with the query.
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); const q = $("search").value.trim(); location.href = "library.html" + (q ? `?q=${encodeURIComponent(q)}` : ""); });
$("account").addEventListener("click", async () => { await clearSession(); location.href = "login.html"; });
load();
