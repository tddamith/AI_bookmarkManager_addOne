import { $, api, getSession, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { setFieldError, clearFieldError, withBusy } from "./forms.js";
renderPanelHead($("head"), "", { light: true });

const COLORS = [["#111111", "#FFFFFF"], ["#D4FA1E", "#111111"], ["#FFFFFF", "#111111"], ["#C9B597", "#111111"], ["#F4F4F1", "#111111"], ["#CFCFCC", "#111111"]];
const NEXT = "tip.html";
const num = (n) => n.toLocaleString();
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); n.append(...kids); return n; };
const ICON = (fill) => `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="${fill}"/></svg>`;
const count = (n) => (n.url ? 1 : (n.children ?? []).reduce((s, c) => s + count(c), 0));

let stash = null, rows = [], summary = null, editing = false, showAll = false;

async function load() {
  if (!(await getSession())) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;
  const { importState } = await api.storage.local.get("importState"); summary = importState?.summary ?? null;
  const roots = await api.bookmarks.getTree(); const other = roots[0].children[1] ?? roots[0].children[0];
  stash = (other.children ?? []).find((c) => !c.url && /^stash$/i.test(c.title)) ?? null;
  rows = stash ? (stash.children ?? []).filter((c) => !c.url).map((f) => ({ id: f.id, name: f.title, n: count(f) })).filter((r) => r.n).sort((a, b) => b.n - a.n) : [];
  paint();
}

function paint() {
  const total = rows.reduce((s, r) => s + r.n, 0);
  $("stats").replaceChildren(...[[rows.length, rows.length === 1 ? "folder" : "folders"], [num(total), "saves"], [num(summary?.dups ?? 0), "duplicates left out"]].map(([v, l]) => el("span", {}, el("b", { textContent: String(v) }), l)));
  if (!rows.length) { $("h1").textContent = "Nothing to review"; $("folders").replaceChildren(); $("change").hidden = true; $("status").textContent = "No imported bookmarks yet. You can start saving pages from Home."; $("ok").textContent = "Continue"; return; }
  const shown = editing || showAll ? rows : rows.slice(0, 6);
  $("folders").replaceChildren(...shown.map((r, i) => {
    const [bg, fg] = COLORS[i % COLORS.length];
    const ico = el("span", { className: "ico" }); ico.style.background = bg; ico.style.border = bg === "#F4F4F1" || bg === "#FFFFFF" ? "1px solid #111" : "0"; ico.innerHTML = ICON(fg);
    if (!editing) return el("li", {}, ico, el("span", { className: "nm", textContent: r.name }), el("span", { className: "n", textContent: String(r.n) }));
    const input = el("input", { id: `f-${r.id}`, value: r.name, autocomplete: "off" }); input.dataset.id = r.id; input.setAttribute("aria-label", `Rename ${r.name}`);
    input.addEventListener("input", () => clearFieldError(input));
    return el("li", { className: "edit" }, ico, el("div", { className: "pill-field" }, input), el("span", { className: "n", textContent: String(r.n) }));
  }));
  $("all").hidden = editing || rows.length <= 6; $("all").textContent = showAll ? "Show fewer" : `See all ${rows.length}`;
  $("ok").textContent = editing ? "Save changes" : "Looks good"; $("change").textContent = editing ? "Cancel" : "Change";
}

async function saveRenames() {
  const inputs = [...document.querySelectorAll("#folders input")]; let ok = true; const names = new Set();
  for (const i of inputs) {
    const v = i.value.trim().replace(/[›>]/g, "-");
    if (!v) { setFieldError(i, "Name this folder"); ok = false; }
    else if (names.has(v.toLowerCase())) { setFieldError(i, "Another folder already uses this name"); ok = false; }
    else { names.add(v.toLowerCase()); i.value = v; }
  }
  if (!ok) { inputs.find((i) => i.getAttribute("aria-invalid"))?.focus(); return false; }
  for (const i of inputs) { const r = rows.find((x) => x.id === i.dataset.id); if (r && r.name !== i.value) await api.bookmarks.update(r.id, { title: i.value }); }
  return true;
}
async function done() { location.href = NEXT; }

$("ok").onclick = (e) => withBusy(e.currentTarget, async () => {
  if (!editing) return done();
  if (await saveRenames()) { editing = false; $("status").textContent = "Changes saved."; await load(); }
});
$("change").onclick = () => { editing = !editing; $("status").textContent = ""; if (!editing) load(); else paint(); if (editing) document.querySelector("#folders input")?.focus(); };
$("all").onclick = () => { showAll = !showAll; paint(); };
load();
