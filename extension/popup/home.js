import { api, $, getSession, clearSession, AI, authHeaders, trackAi, getPrefs, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { renderTabs } from "./tabs.js";
import { withBusy } from "./forms.js";
import { favicon } from "./favicon.js";
import { HIDE, loadHide, stripStash } from "./hide.js";

renderPanelHead($("head"), `<button id="account" type="button" class="avatar" aria-label="Profile" title="Profile">S</button>`);
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

// ── Summary (opt-in; Haiku 5.5 via proxy when AI.endpoint is set, else local) ────────────────────────────────
// Reading page content is opt-in: Stash asks for this site's permission, reads the text once on this device,
// and picks the most informative sentences. Nothing is sent anywhere.
const STOP = new Set("the a an and or but if of to in on at for with from by as is are was were be been it its this that these those you your we our they their he she i not no so than then too very can will just about into over also more most such".split(" "));
const sums = new Map();   // url -> { words, sents, longer }
let aiLimited = false;
// Cache of AI summaries by URL (storage.local): a page is never summarized (or billed against quota) twice.
const CACHE_MAX = 200, CACHE_TTL = 30 * DAY;
async function cacheGet(url) {
  const { sumCache = {} } = await api.storage.local.get("sumCache"), e = sumCache[normUrl(url)];
  return e && Date.now() - e.t < CACHE_TTL ? e : null;
}
async function cachePut(url, words, bullets) {
  const { sumCache = {} } = await api.storage.local.get("sumCache");
  sumCache[normUrl(url)] = { t: Date.now(), words, bullets };
  const keep = Object.entries(sumCache).sort((a, b) => b[1].t - a[1].t).slice(0, CACHE_MAX);
  await api.storage.local.set({ sumCache: Object.fromEntries(keep) });
}
let sumLonger = false, sumBusy = false, sumMsg = "";
function extract(text, words) {
  const sents = (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 260 && !/^(share|copyright|sign up|subscribe|cookie)/i.test(s));
  const freq = new Map(); sents.forEach((s) => s.toLowerCase().split(/[^a-z0-9]+/).forEach((w) => w.length > 2 && !STOP.has(w) && freq.set(w, (freq.get(w) ?? 0) + 1)));
  const scored = sents.map((s, i) => { const ws = s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)); return { s, i, sc: ws.reduce((t, w) => t + (freq.get(w) ?? 0), 0) / Math.sqrt(ws.length || 1) }; });
  const ranked = scored.sort((a, b) => b.sc - a.sc);
  return { words, bullets: (n) => ranked.slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s) };
}
async function runSummary() {
  if (!tab) return; sumBusy = true; sumMsg = ""; paintSummary(new URL(tab.url).hostname);
  try {
    const hit = await cacheGet(tab.url);   // cached AI summary: no page read, no permission prompt, no quota used
    if (hit) { sums.set(tab.url, { words: hit.words, bullets: (n) => hit.bullets.slice(0, n) }); return; }
    const origins = [new URL(tab.url).origin + "/*"];
    if (!(await api.permissions.contains({ origins })) && !(await api.permissions.request({ origins }))) { sumMsg = "Stash needs your OK to read this page. Nothing was read."; return; }
    const [{ result }] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: () => { const el = document.querySelector("article, main, [role=main]") || document.body; return { text: (el.innerText || "").slice(0, 60000), words: (document.body.innerText || "").split(/\s+/).filter(Boolean).length }; } });
    let s = null;
    if (AI.endpoint && (await getPrefs()).aiReadPages) {   // Claude Haiku 5.5 via proxy; falls back to the on-device summary on any failure
      try {
        const r = await fetch(AI.endpoint + "/ai", { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ title: tab.title, url: tab.url, text: result.text.slice(0, AI.maxChars) }) });
        aiLimited = r.status === 429;
        const { bullets = [], used, limit } = r.ok ? await r.json() : {};
        if (r.ok) await trackAi("summary", used, limit);
        if (bullets.length) s = { words: result.words, bullets: (n) => bullets.slice(0, n) };
        if (bullets.length) await cachePut(tab.url, result.words, bullets);
      } catch {}
    }
    s ??= extract(result.text, result.words);
    if (!s.bullets(1).length) { sumMsg = "There isn't enough text on this page to summarize."; return; }
    sums.set(tab.url, s);
    if (aiLimited) toast("Monthly AI limit reached. Used the on-device summary instead.");
  } catch { sumMsg = "Couldn't read this page. Try reloading it."; }
  finally { sumBusy = false; paintPage(); }
}
function paintSummary(host) {
  const body = $("sumBody"); body.replaceChildren(); $("sumBtns").hidden = true; $("readTime").textContent = "";
  $("sum").hidden = !host; if (!host) return;
  const s = sums.get(tab.url);
  if (s) {
    $("readTime").textContent = `${Math.max(1, Math.round(s.words / 220))} min read`; $("sumBtns").hidden = false;
    $("longer").textContent = sumLonger ? "Shorter" : "Longer"; $("longer").setAttribute("aria-pressed", sumLonger);
    body.append(el("ul", { className: "sumlist" }, ...s.bullets(sumLonger ? 5 : 3).map((t) => el("li", { textContent: t }))));
    return;
  }
  const btn = el("button", { type: "button", className: "btn sm outline", textContent: sumBusy ? "Reading…" : "Summarize this page" });
  if (sumBusy) btn.setAttribute("aria-busy", "true"); btn.onclick = runSummary;
  body.append(el("div", { className: "sumask" }, el("span", { textContent: sumMsg || (aiLimited ? "Monthly AI limit reached. Using the on-device summary." : AI.endpoint ? "Sends this page's text to Stash AI to write a summary. Only when you tap." : "Reads this page once, on this device. Nothing is sent anywhere.") }), btn));
}
$("longer").onclick = () => { sumLonger = !sumLonger; paintSummary(new URL(tab.url).hostname); };
$("copy").onclick = async (e) => { const s = sums.get(tab.url); if (!s) return; await navigator.clipboard.writeText(s.bullets(sumLonger ? 5 : 3).map((t) => "• " + t).join("\n")); const b = e.currentTarget; b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); };

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
  $("save").textContent = dup ? "Saved" : (host && sums.has(tab.url) ? "Save with summary" : "Save page"); $("save").disabled = !host || !!dup;
  $("later").disabled = !host || !!dup;
  paintSummary(host);
}
// "Save page" opens the Save page screen (folder, tags, note, reminder).
$("save").onclick = async () => {
  const s = tab && sums.get(tab.url);
  if (s) await api.storage.session.set({ pendingSummary: { url: tab.url, text: s.bullets(3).join("\n") } });   // prefilled as the note
  location.href = "save.html";
};
$("later").onclick = (e) => withBusy(e.currentTarget, async () => {
  const f = await folderNamed(/read\s*later/i, "Read later");
  const b = await api.bookmarks.create({ parentId: f.id, title: tab.title, url: tab.url });
  toast("Added to Read later.", () => api.bookmarks.remove(b.id));
  await load();
});
api.tabs.onActivated.addListener(paintPage);
api.tabs.onUpdated.addListener((_i, info) => { if (info.url || info.status === "complete") paintPage(); });

// ── Stats and suggestions ──────────────────────────────
async function load() {
  const session = await getSession();
  if (!session) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;     // sign-up not finished: confirm the email first (OTP)
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
$("account").addEventListener("click", () => { location.href = "profile.html"; });
load();
