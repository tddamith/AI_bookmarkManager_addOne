import { api, $, getSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { initForms, validate, withBusy } from "./forms.js";
import { favicon } from "./favicon.js";
import { HIDE, loadHide, stripStash } from "./hide.js";
renderPanelHead($("head"), "", { back: "home.html", light: true });
initForms();

const STOP = new Set("the and for with from your you are this that what how why when into about guide complete using use best top new www com org net http https html page pages".split(" "));
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
let tab, roots, marks = [], selected = new Set(), remind = "never";

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

function paintTags(all) {
  const box = $("tags"); box.replaceChildren();
  all.forEach((t) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "tag";
    const on = selected.has(t); b.setAttribute("aria-pressed", on); b.textContent = on ? `#${t}` : `+ #${t}`;
    b.onclick = () => { on ? selected.delete(t) : selected.add(t); paintTags(all); box.querySelector(`.tag:nth-child(${all.indexOf(t) + 1})`)?.focus(); };
    box.append(b);
  });
  $("tagHint").hidden = !all.length;
}

(async () => {
  if (!(await getSession())) { location.href = "login.html"; return; }
  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  await loadHide(); roots = await api.bookmarks.getTree(); marks = flatten(roots);
  let host = ""; try { const u = new URL(tab?.url ?? ""); if (/^https?:$/.test(u.protocol)) host = u.hostname; } catch {}
  if (!host) { $("title").textContent = "Open a web page to save it"; $("save").disabled = true; $("folder").disabled = true; return; }
  $("icon").replaceChildren(favicon(tab.url));
  $("title").textContent = tab.title || host;
  { const { pendingSummary } = await api.storage.session.get("pendingSummary"); if (pendingSummary?.url === tab.url) { $("note").value = pendingSummary.text; await api.storage.session.remove("pendingSummary"); } }
  if (marks.some((b) => normUrl(b.url) === normUrl(tab.url))) { $("status").textContent = "You've already saved this page."; $("save").disabled = true; }
  const sug = suggestFolder(host);
  if (sug) { $("folder").value = sug; $("pick").hidden = false; $("pickText").textContent = "From your saves"; }
  const tags = suggestTags(tab.title, tab.url); tags.slice(0, 2).forEach((t) => selected.add(t)); paintTags(tags);
})();

document.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => {
  remind = b.dataset.r; document.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-pressed", x === b));
}));

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate([{ input: $("folder"), ok: !!$("folder").value.trim(), message: "Name a folder" }])) return;
  await withBusy($("save"), async () => {
    try {
      const parentId = await ensurePath($("folder").value);
      const bm = await api.bookmarks.create({ parentId, title: tab.title, url: tab.url });
      const at = remind === "tomorrow" ? Date.now() + 864e5 : remind === "week" ? Date.now() + 7 * 864e5 : null;
      const { stashMeta = {} } = await api.storage.local.get("stashMeta");   // Chrome bookmarks have no tags/notes: keep them here
      stashMeta[bm.id] = { tags: [...selected], note: $("note").value.trim(), remindAt: at };
      await api.storage.local.set({ stashMeta });
      location.href = "home.html";
    } catch { $("status").textContent = "Couldn't save this page. Try again."; }
  });
});
