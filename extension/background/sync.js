// Bookmark sync: keeps this browser's bookmarks (plus Stash tags/notes/reminders) in step with your account.
//
// Model: every bookmark gets a random `syncId` (Chrome's own ids differ per device). Local edits are queued, then pushed in
// small batches to POST /sync, which also returns whatever changed elsewhere since our `cursor`. Last write wins per bookmark;
// deletes travel as tombstones. See AI_bookmarkManager_api/app/routers/sync.py for the server half.
//
// Runs in the service worker, so it listens to bookmark events even when the side panel is closed.
import { api, AI, getSession, authHeaders } from "../popup/config.js";

const ROOT_TOKENS = ["@bar", "@other", "@mobile"];     // top-level folders are named by position, so "Bookmarks bar" == "Favorites"
const BATCH = 200, DEBOUNCE_MS = 3000, ALARM = "stash-sync";

// ── tiny async mutex: events and the sync loop never interleave ─────────────
let lock = Promise.resolve();
const withLock = (fn) => { const run = lock.then(() => fn()); lock = run.catch(() => {}); return run; };

// ── persisted state ─────────────────────────────────────────────────────────
const fresh = (owner = null) => ({ owner, cursor: 0, init: false, map: {}, known: {}, queue: {}, lastAt: 0, error: "" });
async function load() { const { sync } = await api.storage.local.get("sync"); return { ...fresh(), ...(sync ?? {}) }; }
const save = (s) => api.storage.local.set({ sync: s });

/** 53-bit string hash (cyrb53): a compact fingerprint of a bookmark's synced fields, to tell real edits from echoes. */
function hash(o) {
  const str = JSON.stringify(o); let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const fieldsHash = (f) => hash([f.title, f.url, f.folderPath, f.tags, f.note, f.remindAt]);

// ── reading local bookmarks ─────────────────────────────────────────────────
async function makeCtx() {
  const [root] = await api.bookmarks.getTree();
  const { stashMeta = {} } = await api.storage.local.get("stashMeta");
  return { tops: root.children.map((c) => c.id), meta: stashMeta, paths: new Map(), folders: new Map(), metaDirty: false };
}
/** ["@bar", "Dev", "Docs"] for the folder `id`. */
async function folderPath(id, ctx) {
  if (ctx.paths.has(id)) return ctx.paths.get(id);
  const top = ctx.tops.indexOf(id);
  let path;
  if (top >= 0) path = [ROOT_TOKENS[top] ?? "@other"];
  else { const [n] = await api.bookmarks.get(id); path = n.parentId ? [...(await folderPath(n.parentId, ctx)), n.title] : []; }
  ctx.paths.set(id, path);
  return path;
}
const isSyncable = (n) => !!n?.url && /^https?:/i.test(n.url);
async function fieldsOf(node, ctx) {
  const meta = ctx.meta[node.id] ?? {};
  return { title: node.title || node.url, url: node.url, folderPath: await folderPath(node.parentId, ctx), tags: meta.tags ?? [], note: meta.note ?? "", remindAt: meta.remindAt ?? null };
}
const subtree = async (id) => { try { return (await api.bookmarks.getSubTree(id))[0]; } catch { return null; } };
function* urlNodes(node) { if (isSyncable(node)) yield node; for (const c of node.children ?? []) yield* urlNodes(c); }

// ── queueing local changes ──────────────────────────────────────────────────
/** Queue an upsert for a bookmark if its synced fields differ from what the server last had. */
async function noteUpsert(s, node, ctx) {
  if (!isSyncable(node) || !s.init) return;          // before the first pull, bootstrapLocal() picks everything up after matching with the server
  const f = await fieldsOf(node, ctx);
  const syncId = (s.map[node.id] ??= crypto.randomUUID());
  if (s.known[syncId] === fieldsHash(f) && !s.queue[syncId]?.del) return;
  s.queue[syncId] = { at: Date.now() };
}
const noteDelete = (s, chromeId) => { const id = s.map[chromeId]; if (!id) return; s.queue[id] = { at: Date.now(), del: true }; delete s.map[chromeId]; };

/** Run `fn(state, ctx)` under the lock, persist, and schedule a sync. Used by every event handler. */
function onLocalChange(fn) {
  withLock(async () => { const s = await load(); const ctx = await makeCtx(); await fn(s, ctx); await save(s); }).then(schedule, () => {});
}
api.bookmarks.onCreated.addListener((id, node) => onLocalChange(async (s, ctx) => { for (const n of urlNodes(node)) await noteUpsert(s, n, ctx); }));
api.bookmarks.onChanged.addListener((id) => onLocalChange(async (s, ctx) => {          // a renamed folder changes every path below it
  for (const n of urlNodes(await subtree(id) ?? {})) await noteUpsert(s, n, ctx);
}));
api.bookmarks.onMoved.addListener((id) => onLocalChange(async (s, ctx) => {
  for (const n of urlNodes(await subtree(id) ?? {})) await noteUpsert(s, n, ctx);
}));
api.bookmarks.onRemoved.addListener((id, info) => onLocalChange(async (s) => { for (const n of urlNodes(info.node ?? { id, url: "http://x" })) noteDelete(s, n.id); }));
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.stashMeta) onLocalChange(async (s, ctx) => {                                // tags / note / reminder edits
    const ids = new Set([...Object.keys(changes.stashMeta.newValue ?? {}), ...Object.keys(changes.stashMeta.oldValue ?? {})]);
    for (const id of ids) { if (!s.map[id]) continue; try { const [n] = await api.bookmarks.get(id); await noteUpsert(s, n, ctx); } catch {} }
  });
  if (changes.session) schedule();                                                       // just signed in (or out)
});

// ── applying remote changes ─────────────────────────────────────────────────
async function ensureFolder(path, ctx) {
  const key = path.join("\u0000");
  if (ctx.folders.has(key)) return ctx.folders.get(key);
  const idx = ROOT_TOKENS.indexOf(path[0]);
  let parent = ctx.tops[idx >= 0 ? idx : 1] ?? ctx.tops[0];
  for (const title of idx >= 0 ? path.slice(1) : path) {
    const kids = await api.bookmarks.getChildren(parent);
    parent = (kids.find((k) => !k.url && k.title === title) ?? (await api.bookmarks.create({ parentId: parent, title }))).id;
  }
  ctx.folders.set(key, parent);
  return parent;
}
async function applyRemote(s, items, ctx) {
  const rev = Object.fromEntries(Object.entries(s.map).map(([c, id]) => [id, c]));
  for (const it of items) {
    const chromeId = rev[it.syncId], pending = s.queue[it.syncId];
    if (pending && !pending.del && pending.at > (it.clientAt ?? 0)) continue;               // our newer local edit wins; it is pushed next
    if (it.deleted) {
      if (chromeId) { try { await api.bookmarks.remove(chromeId); } catch {} delete s.map[chromeId]; delete rev[it.syncId]; }
      delete s.known[it.syncId]; delete s.queue[it.syncId];
      continue;
    }
    const parentId = await ensureFolder(it.folderPath ?? [], ctx);
    let node = null;
    if (chromeId) { try { [node] = await api.bookmarks.get(chromeId); } catch {} }
    if (!node) {
      const mapped = new Set(Object.keys(s.map));
      node = (await api.bookmarks.getChildren(parentId)).find((k) => k.url === it.url && !mapped.has(k.id))   // already have it locally: adopt, don't duplicate
        ?? await api.bookmarks.create({ parentId, title: it.title, url: it.url });
      s.map[node.id] = it.syncId; rev[it.syncId] = node.id;
    }
    if (node.title !== it.title || node.url !== it.url) await api.bookmarks.update(node.id, { title: it.title, url: it.url });
    if (node.parentId !== parentId) await api.bookmarks.move(node.id, { parentId });
    ctx.meta[node.id] = { ...(ctx.meta[node.id] ?? {}), tags: it.tags ?? [], note: it.note ?? "", remindAt: it.remindAt ?? null }; ctx.metaDirty = true;
    const [now] = await api.bookmarks.get(node.id);
    s.known[it.syncId] = fieldsHash(await fieldsOf(now, ctx));
    delete s.queue[it.syncId];
  }
  if (ctx.metaDirty) { await api.storage.local.set({ stashMeta: ctx.meta }); ctx.metaDirty = false; }
}

/** First sync on this device: give every local bookmark the server doesn't know yet a syncId and queue it. */
async function bootstrapLocal(s, ctx) {
  const [root] = await api.bookmarks.getTree();
  for (const n of urlNodes(root)) { if (!s.map[n.id]) await noteUpsert(s, n, ctx); }
}
/** Mark every mapped bookmark dirty (used after the server says our cursor is from another database). */
async function requeueAll(s, ctx) {
  const [root] = await api.bookmarks.getTree();
  s.known = {};
  for (const n of urlNodes(root)) await noteUpsert(s, n, ctx);
}

// ── the sync loop ───────────────────────────────────────────────────────────
async function post(body) {
  const r = await fetch(`${AI.endpoint}/sync`, { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(body) });
  if (r.status === 401) { const e = new Error("Signed out. Log in again to sync."); e.auth = true; throw e; }
  if (!r.ok) throw new Error(`Sync failed (${r.status})`);
  return r.json();
}
async function buildBatch(s, ctx) {
  const rev = Object.fromEntries(Object.entries(s.map).map(([c, id]) => [id, c]));
  const out = [];
  for (const [syncId, op] of Object.entries(s.queue)) {
    if (out.length >= BATCH) break;
    if (op.del) { out.push({ op, change: { syncId, deleted: true, clientAt: op.at } }); continue; }
    let node = null; try { [node] = rev[syncId] ? await api.bookmarks.get(rev[syncId]) : []; } catch {}
    if (!isSyncable(node)) { delete s.queue[syncId]; continue; }                             // vanished before we could push it
    const f = await fieldsOf(node, ctx);
    out.push({ op, fields: f, change: { syncId, ...f, deleted: false, clientAt: op.at } });
  }
  return out;
}
async function runSync() {
  const session = await getSession();
  if (!AI.endpoint || !session?.token) return { ok: false, skipped: true };
  let s = await load();
  if (s.owner && s.owner !== session.email) s = fresh();                                     // another account on this browser: start clean
  s.owner = session.email;
  try {
    for (let round = 0; round < 40; round++) {
      const ctx = await makeCtx();
      const batch = s.init ? await buildBatch(s, ctx) : [];                                   // first round only pulls, so we can adopt matches
      const res = await post({ cursor: s.cursor, changes: batch.map((b) => b.change) });
      for (const b of batch) { if (b.fields) s.known[b.change.syncId] = fieldsHash(b.fields); }
      await applyRemote(s, res.changes, ctx);
      for (const b of batch) if (s.queue[b.change.syncId]?.at === b.op.at) delete s.queue[b.change.syncId];   // pushed (unless edited again meanwhile)
      s.cursor = res.cursor;
      if (res.reset) { s.init = true; await requeueAll(s, ctx); }
      if (!s.init && !res.more) { s.init = true; await bootstrapLocal(s, ctx); }
      await save(s);
      if (!res.more && !Object.keys(s.queue).length) break;
    }
    s.lastAt = Date.now(); s.error = ""; await save(s);
    return { ok: true };
  } catch (e) {
    s.error = String(e.message ?? e); await save(s);
    return { ok: false, error: s.error };
  }
}
export const syncNow = () => withLock(runSync);

// ── triggers ────────────────────────────────────────────────────────────────
let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(() => { syncNow(); }, DEBOUNCE_MS); }
api.alarms?.onAlarm.addListener((a) => { if (a.name === ALARM) syncNow(); });            // periodic catch-up: also pulls other devices' changes
const arm = () => { api.alarms?.create(ALARM, { periodInMinutes: 5 }); schedule(); };
api.runtime.onInstalled.addListener(arm);
api.runtime.onStartup.addListener(arm);
api.runtime.onMessage.addListener((msg, _sender, respond) => { if (msg?.type === "sync-now") { syncNow().then(respond); return true; } });
