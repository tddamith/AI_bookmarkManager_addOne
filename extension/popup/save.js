import { api, $, getSession, AI, authHeaders, trackAi, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { initForms, validate, withBusy } from "./forms.js";
import { favicon } from "./favicon.js";
import { HIDE, loadHide, stripStash } from "./hide.js";
renderPanelHead($("head"), "", { back: "home.html", light: true });
initForms();

const STOP = new Set("the and for with from your you are this that what how why when into about guide complete using use best top new www com org net http https html page pages".split(" "));
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
let tab, roots, marks = [], selected = new Set(), remind = "never", touched = false;
const SEP = " › ";
const PALETTE = [["#111111", "Black"], ["#D4FA1E", "Lime"], ["#A6C3DD", "Sky blue"], ["#C9B597", "Tan"], ["#CFCFCC", "Gray"], ["#FFFFFF", "White"]];
let fsel = "Stash", fopen = false, fq = "", folders = [], aiFolders = [], pickNote = "", colors = {}, localSug = null;

function flatten(rs) {
  const out = []; const walk = (n, path) => (n.url ? (!HIDE.has(n.id) && out.push({ ...n, path: stripStash(path) })) : (n.children ?? []).forEach((c) => walk(c, [...path, n.title])));
  rs[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, [])));
  return out;
}
const otherRoot = () => roots[0].children[1] ?? roots[0].children[0];

/** Keyword guesses from the page title, URL and path (no AI/network). */
function suggestTags(t, url) {
  const words = new Map();
  const add = (w, wt) => { w = w.toLowerCase().replace(/[^a-z0-9]/g, ""); if (w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)) words.set(w, (words.get(w) ?? 0) + wt); };
  (t || "").split(/[\s\-–—|:·,.]+/).forEach((w) => add(w, 2));
  try { const u = new URL(url); u.hostname.split(".").slice(0, -1).filter((p) => p !== "www").forEach((w) => add(w, 1)); u.pathname.split(/[\/\-_]+/).forEach((w) => add(w, 1)); } catch {}
  return [...words.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, 4);
}
/** Folder used most for this site, as a "A › B" path; null if none. */
function suggestFolder(host) {
  const counts = new Map();
  marks.filter((b) => { try { return new URL(b.url).hostname === host; } catch { return false; } }).forEach((b) => { if (b.path.length) { const p = b.path.join(" › "); counts.set(p, (counts.get(p) ?? 0) + 1); } });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
async function ensurePath(text) {
  let parent = otherRoot().id;
  for (const part of text.split(/[›>/]/).map((s) => s.trim()).filter(Boolean)) {
    const kids = await api.bookmarks.getChildren(parent);
    const hit = kids.find((k) => !k.url && k.title.toLowerCase() === part.toLowerCase());
    parent = (hit ?? await api.bookmarks.create({ parentId: parent, title: part })).id;
  }
  return parent;
}

/** Every folder (nested paths as "A › B") with its save count. */
function listFolders() {
  const names = new Set(["Stash"]);
  const walk = (n, path) => { if (n.url || HIDE.has(n.id)) return; const full = [...path, n.title], p = stripStash(full); if (p.length) names.add(p.join(SEP)); (n.children ?? []).forEach((c) => walk(c, full)); };
  roots[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, [])));
  const count = (name) => marks.filter((m) => { const j = m.path.join(SEP); return j === name || j.startsWith(name + SEP); }).length;
  return [...names].map((name) => ({ name, n: count(name) })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
const colorOf = (name) => colors[name] ?? "#D4FA1E";
const svgFolder = (fill) => { const n = document.createElementNS("http://www.w3.org/2000/svg", "svg"); n.setAttribute("width", 18); n.setAttribute("height", 18); n.setAttribute("viewBox", "0 0 24 24"); n.setAttribute("aria-hidden", "true"); n.style.flexShrink = 0; n.innerHTML = `<path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="${fill}" stroke="#111" stroke-width="1.2"/>`; return n; };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

function chooseFolder(name, note = "") {
  fsel = name; pickNote = note; fopen = false; fq = ""; paintFolder();
}
function paintFolder() {
  const input = $("folder"), q = fq.trim().toLowerCase();
  input.value = fopen ? fq : fsel; input.placeholder = fopen ? fsel : "Search or create a folder";
  input.setAttribute("aria-expanded", fopen); $("ftoggle").setAttribute("aria-expanded", fopen);
  $("fico").setAttribute("fill", colorOf(fsel));
  $("pick").hidden = !pickNote; $("pickText").textContent = pickNote;
  $("save").textContent = `Save to ${fsel}`;
  $("colName").textContent = fsel;
  $("swatches").querySelectorAll(".sw").forEach((b) => b.setAttribute("aria-checked", b.dataset.c === colorOf(fsel)));
  const list = $("flist"); list.hidden = !fopen; list.replaceChildren(); if (!fopen) return;
  const known = new Map(folders.map((f) => [f.name, f]));
  const match = (name) => !q || name.toLowerCase().includes(q);
  const aiNames = [...new Set([localSug, ...aiFolders].filter(Boolean))].filter(match);
  const row = (name, note) => {
    const b = el("button", "fopt"); b.type = "button"; b.setAttribute("role", "option"); b.setAttribute("aria-selected", name === fsel);
    const t = el("span", "t"); t.append(el("span", "n", name), el("span", "s", note)); b.append(svgFolder(colorOf(name)), t);
    b.onclick = () => chooseFolder(name, aiNames.includes(name) ? (name === localSug ? "From your saves" : "AI pick") : "");
    return b;
  };
  if (aiNames.length) {
    const h = el("div", "fhead"); h.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z" fill="#111"/></svg>`; h.append("AI suggests —"); list.append(h);
    aiNames.forEach((n) => list.append(row(n, n === localSug ? "From your saves" : known.has(n) ? `AI · ${known.get(n).n} saves here` : "AI · new folder")));
  }
  const others = folders.filter((f) => !aiNames.includes(f.name) && match(f.name));
  if (others.length) { list.append(el("div", "fhead sep", q ? "Matching folders —" : "All folders —")); others.forEach((f) => list.append(row(f.name, `${f.n} saves`))); }
  if (q && !known.has(fq.trim()) && !folders.some((f) => f.name.toLowerCase() === q)) {
    const c = el("button", "fcreate"); c.type = "button"; c.innerHTML = `<span class="plus">+</span>`; c.append(`Create folder “${fq.trim()}”`);
    c.onclick = () => chooseFolder(fq.trim().replace(/\s*[>/]\s*/g, SEP)); list.append(c);
  } else if (q && !aiNames.length && !others.length) list.append(el("div", "fnone", "No folder matches yet."));
}
function initFolderPicker() {
  $("swatches").replaceChildren(...PALETTE.map(([c, label]) => { const b = el("button", "sw"); b.type = "button"; b.dataset.c = c; b.style.background = c; b.setAttribute("role", "radio"); b.setAttribute("aria-label", label); b.onclick = () => { colors[fsel] = c; paintFolder(); }; return b; }));
  const input = $("folder");
  input.addEventListener("focus", () => { if (!fopen) { fopen = true; fq = ""; paintFolder(); } });
  input.addEventListener("input", () => { fq = input.value; fopen = true; paintFolder(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { fopen = false; fq = ""; paintFolder(); }
    if (e.key === "Enter" && fopen) { e.preventDefault(); $("flist").querySelector(".fopt, .fcreate")?.click(); }
    if (e.key === "ArrowDown" && fopen) { e.preventDefault(); $("flist").querySelector(".fopt, .fcreate")?.focus(); }
  });
  $("flist").addEventListener("keydown", (e) => {
    const items = [...$("flist").querySelectorAll(".fopt, .fcreate")], i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i <= 0 ? input : items[i - 1]).focus(); }
    if (e.key === "Escape") { fopen = false; paintFolder(); input.focus(); }
  });
  $("ftoggle").addEventListener("click", () => { fopen = !fopen; fq = ""; paintFolder(); if (fopen) input.focus(); });
  document.addEventListener("click", (e) => { if (fopen && !$("fwrap").contains(e.target)) { fopen = false; fq = ""; paintFolder(); } });
}

function paintTags(all) {
  const box = $("tags"); box.replaceChildren();
  all.forEach((t) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "tag";
    const on = selected.has(t); b.setAttribute("aria-pressed", on); b.textContent = on ? `#${t}` : `+ #${t}`;
    b.onclick = () => { touched = true; on ? selected.delete(t) : selected.add(t); paintTags(all); box.querySelector(`.tag:nth-child(${all.indexOf(t) + 1})`)?.focus(); };
    box.append(b);
  });
  $("tagHint").hidden = !all.length;
}

(async () => {
  if (!(await getSession())) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;
  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  await loadHide(); roots = await api.bookmarks.getTree(); marks = flatten(roots);
  folders = listFolders(); colors = (await api.storage.local.get("folderColors")).folderColors ?? {}; initFolderPicker(); paintFolder();
  let host = ""; try { const u = new URL(tab?.url ?? ""); if (/^https?:$/.test(u.protocol)) host = u.hostname; } catch {}
  if (!host) { $("title").textContent = "Open a web page to save it"; $("save").disabled = true; $("folder").disabled = true; $("ftoggle").disabled = true; return; }
  $("icon").replaceChildren(favicon(tab.url));
  $("title").textContent = tab.title || host;
  { const { pendingSummary } = await api.storage.session.get("pendingSummary"); if (pendingSummary?.url === tab.url) { $("note").value = pendingSummary.text; await api.storage.session.remove("pendingSummary"); } }
  if (!$("note").value) { const { sumCache = {} } = await api.storage.local.get("sumCache"); const c = sumCache[normUrl(tab.url)]; if (c) $("note").value = c.bullets.slice(0, 2).join(" "); }
  if (marks.some((b) => normUrl(b.url) === normUrl(tab.url))) { $("status").textContent = "You've already saved this page."; $("save").disabled = true; }
  const sug = suggestFolder(host);
  if (sug) { localSug = sug; chooseFolder(sug, "From your saves"); }
  const tags = suggestTags(tab.title, tab.url); tags.slice(0, 2).forEach((t) => selected.add(t)); paintTags(tags);
  if (AI.endpoint) aiSuggest(host, !!sug);
})();

/** Haiku 5.5 tag + folder suggestions. Local guesses show instantly; AI results replace them unless the user already edited. */
async function aiSuggest(host, hasHistory) {
  try {
    const { sumCache = {} } = await api.storage.local.get("sumCache");   // reuse a cached summary if this page has one
    const summary = (sumCache[normUrl(tab.url)]?.bullets ?? []).join(" ");
    const known = folders.map((f) => f.name).slice(0, 60);
    const r = await fetch(AI.endpoint + "/ai", { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ task: "suggest", title: tab.title, url: tab.url, summary, folders: known }) });
    if (!r.ok) return;
    const { tags = [], folders: sugg = [], used, limit } = await r.json();
    await trackAi("pick", used, limit);
    if (tags.length && !touched) { selected = new Set(tags.slice(0, 3)); paintTags(tags); }
    aiFolders = sugg;
    if (sugg[0] && !hasHistory && fsel === "Stash" && !pickNote) chooseFolder(sugg[0], "AI pick"); else paintFolder();
  } catch {}   // offline or over quota: keep the local guesses
}

document.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => {
  remind = b.dataset.r; document.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-pressed", x === b));
}));

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fsel.trim()) { $("status").textContent = "Pick or create a folder."; return; }
  await withBusy($("save"), async () => {
    try {
      const parentId = await ensurePath(fsel);
      if (colors[fsel]) { const { folderColors = {} } = await api.storage.local.get("folderColors"); folderColors[fsel] = colors[fsel]; await api.storage.local.set({ folderColors }); }
      const bm = await api.bookmarks.create({ parentId, title: tab.title, url: tab.url });
      const at = remind === "tomorrow" ? Date.now() + 864e5 : remind === "week" ? Date.now() + 7 * 864e5 : null;
      const { stashMeta = {} } = await api.storage.local.get("stashMeta");   // Chrome bookmarks have no tags/notes: keep them here
      stashMeta[bm.id] = { tags: [...selected], note: $("note").value.trim(), remindAt: at };
      await api.storage.local.set({ stashMeta });
      location.href = "home.html";
    } catch { $("status").textContent = "Couldn't save this page. Try again."; }
  });
});
