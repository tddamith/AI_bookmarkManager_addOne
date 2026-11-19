import { $, api, getSession, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { keywords } from "./topic.js";
renderPanelHead($("head"));

/* "Import from this browser": Stash never edits your bookmarks. It builds organized COPIES in a "Stash" folder
   (one subfolder per original folder; loose saves grouped by site) and stores tags beside them.
   Progress is saved, so closing the panel and coming back resumes where it stopped. */
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (n) => n.toLocaleString();

function setStep(k) {
  const order = ["read", "dups", "folders", "tags"];
  document.querySelectorAll("#checks li").forEach((li) => { const i = order.indexOf(li.dataset.k), c = order.indexOf(k); li.className = i < c || k === "done" ? "done" : i === c ? "active" : ""; });
}
function progress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 100;
  $("count").textContent = `${num(done)} of ${num(total)}`; $("pct").textContent = pct + "%";
  $("fill").style.width = pct + "%"; $("bar").setAttribute("aria-valuenow", pct);
}

function flatten(rs, skipId) {
  const out = []; const walk = (n, path) => { if (n.id === skipId) return; n.url ? out.push({ ...n, path }) : (n.children ?? []).forEach((c) => walk(c, [...path, n.title])); };
  rs[0].children.forEach((top) => (top.children ?? []).forEach((c) => walk(c, [])));
  return out;
}

async function run() {
  const session = await getSession(); if (!session) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;
  $("retry").hidden = true; $("status").textContent = "";
  setStep("read"); progress(0, 0); $("count").textContent = "Reading…";
  let roots = await api.bookmarks.getTree();
  const other = roots[0].children[1] ?? roots[0].children[0];
  const kids = await api.bookmarks.getChildren(other.id);
  const stash = kids.find((k) => !k.url && /^stash$/i.test(k.title)) ?? await api.bookmarks.create({ parentId: other.id, title: "Stash" });
  roots = await api.bookmarks.getTree();
  const all = flatten(roots, stash.id);

  // Duplicates are skipped (kept out of the copy), never deleted from your own bookmarks.
  setStep("dups");
  const seen = new Map(); all.forEach((b) => { const k = normUrl(b.url); const cur = seen.get(k); if (!cur || b.dateAdded > cur.dateAdded) seen.set(k, b); });
  const unique = [...seen.values()].sort((a, b) => a.dateAdded - b.dateAdded);
  const dups = all.length - unique.length;
  await sleep(250);

  // Folder plan: keep original folder names; loose saves go to a site folder (3+ from one site) or "Inbox".
  const loose = unique.filter((b) => !b.path.length); const hostCount = new Map(); loose.forEach((b) => hostCount.set(host(b.url), (hostCount.get(host(b.url)) ?? 0) + 1));
  const folderOf = (b) => (b.path.length ? b.path.slice(0, 2).join(" › ") : (hostCount.get(host(b.url)) >= 3 ? host(b.url) : "Inbox"));

  const { importState } = await api.storage.local.get("importState");
  const doneSet = new Set(importState?.done ?? []);
  const { stashMeta = {} } = await api.storage.local.get("stashMeta");
  const existing = new Map();                         // folder path -> folder id (under Stash)
  const ensure = async (path) => {
    if (existing.has(path)) return existing.get(path);
    let parent = stash.id;
    for (const part of path.split(" › ")) {
      const ch = await api.bookmarks.getChildren(parent);
      parent = (ch.find((c) => !c.url && c.title === part) ?? await api.bookmarks.create({ parentId: parent, title: part })).id;
    }
    existing.set(path, parent); return parent;
  };

  setStep("folders");
  let done = 0, ops = 0; const total = unique.length; const counts = new Map();
  for (const b of unique) { const f = folderOf(b); counts.set(f, (counts.get(f) ?? 0) + 1); }
  unique.forEach((b) => { if (doneSet.has(normUrl(b.url))) done++; });
  progress(done, total);
  for (const b of unique) {
    const key = normUrl(b.url); if (doneSet.has(key)) continue;
    for (let attempt = 0; ; attempt++) {
      try {
        const parentId = await ensure(folderOf(b));
        const nb = await api.bookmarks.create({ parentId, title: b.title, url: b.url });
        const tags = [...keywords(b.title, b.url).entries()].sort((a, c) => c[1] - a[1]).slice(0, 2).map(([w]) => w);
        stashMeta[nb.id] = { tags, note: "", remindAt: null };
        break;
      } catch (e) {
        if (attempt >= 4) throw e;
        $("status").textContent = "Paused — your browser limits how fast bookmarks can be added. Resuming shortly…";
        await sleep(attempt ? 30000 : 8000); $("status").textContent = "";
      }
    }
    doneSet.add(key); done++; ops++; progress(done, total);
    if (ops % 40 === 0) await api.storage.local.set({ stashMeta, importState: { done: [...doneSet], total } });
    if (ops > 80) await sleep(650);                    // stay under the browser's write-rate limit
  }

  setStep("tags");
  await api.storage.local.set({ stashMeta, hiddenOriginals: all.map((b) => b.id) });
  await sleep(300);
  const summary = { total, dups, folders: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })), at: Date.now() };
  await api.storage.local.set({ importState: { done: [...doneSet], total, finished: true, summary } });
  setStep("done"); progress(total, total);
  $("h1").textContent = total ? "All imported" : "Nothing to import";
  $("count").textContent = total ? `${num(total)} of ${num(total)}` : "0 bookmarks";
  $("status").textContent = total ? `${num(total)} bookmarks sorted into ${counts.size} folder${counts.size === 1 ? "" : "s"}${dups ? `, ${num(dups)} duplicate${dups === 1 ? "" : "s"} left out` : ""}.` : "You don't have any browser bookmarks yet. You can start saving pages from Home.";
  $("next").hidden = false;
  if (!total) { $("next").textContent = "Go to Home"; $("next").href = "home.html"; }
}

run().catch((e) => {
  console.error(e); $("status").textContent = "Something went wrong while importing. Your bookmarks are untouched. Try again to continue where it stopped."; $("retry").hidden = false;
});
$("retry").addEventListener("click", () => run().catch(() => { $("retry").hidden = false; }));
