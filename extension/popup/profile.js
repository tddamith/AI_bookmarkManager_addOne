import { api, $, PLAN, getSession, signOut, syncPlan, getAiUsage, getPrefs, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";

renderPanelHead($("head"), "", { back: "home.html", light: true });
const KINDS = [["summary", "Page summaries"], ["pick", "Folder & tag picks"], ["tidy", "Tidy-ups"], ["insight", "Insight ideas"]];
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
async function paintSync() {
  const { sync } = await api.storage.local.get("sync"), note = $("syncNote");
  note.classList.toggle("err", !!sync?.error);
  note.textContent = sync?.error ? sync.error : sync?.lastAt ? `Synced ${ago(sync.lastAt)}` : "Not synced yet";
}
$("syncNow").onclick = async (e) => {
  const b = e.currentTarget; b.disabled = true; b.textContent = "Syncing…";
  try { await api.runtime.sendMessage({ type: "sync-now" }); } catch {}
  b.disabled = false; b.textContent = "Sync now"; paintSync();
};
api.storage.onChanged.addListener((c) => { if (c.sync) paintSync(); });
const soon = (msg) => { $("soon").textContent = msg; };

async function paint() {
  await syncPlan();                                   // Pro status comes from the server (PayPal webhook)
  const s = await getSession();
  if (!s) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;
  const name = s.name || (s.email ? s.email.split("@")[0] : "Your account");
  $("avatar").textContent = (name[0] || "S").toUpperCase(); $("name").textContent = name; $("email").textContent = s.email ?? "";
  const pro = s.plan === "pro";
  $("badge").textContent = pro ? "PRO" : "Free"; $("badge").classList.toggle("pro", pro);

  // Plan card
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const per = s.billing === "monthly" ? "monthly" : "yearly";
  $("planCard").classList.toggle("pro", pro);
  $("compare").hidden = pro; $("planStatus").hidden = !pro; $("upgrade").hidden = pro; $("proBtns").hidden = !pro; $("planRows").hidden = !pro; $("cancelPro").hidden = !pro;
  if (pro) {
    const ending = !!s.ends;                                                    // cancelled: Pro runs until the paid period ends
    $("planName").textContent = `Pro · ${per === "monthly" ? "Monthly" : "Yearly"}`;
    $("planNote").textContent = `${PLAN.price[per]} / ${per === "monthly" ? "month" : "year"}`;
    $("planStatus").textContent = ending ? "Cancelled" : "Active";
    $("planRows").firstElementChild.firstElementChild.textContent = ending ? "Ends" : "Renews";
    $("renews").textContent = s.ends || s.renews ? fmt(s.ends ?? s.renews) : "—";
    $("paidWith").textContent = s.paidWith ?? "PayPal";
  } else {
    $("planName").textContent = "Free"; $("planNote").textContent = "$0 · 1 device";
  }

  // AI credits card
  const u = await getAiUsage(), now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  $("topRow").hidden = pro;
  if (pro) {
    $("reset").textContent = "This month"; $("leftN").textContent = "Unlimited"; $("leftN").classList.add("word"); $("leftOf").textContent = "";
    $("bar").hidden = true; $("usedNote").textContent = `${u.used ?? 0} AI action${u.used === 1 ? "" : "s"} used this month`;
  } else {
    const limit = u.limit ?? PLAN.freeAiPerMonth, used = Math.min(u.used ?? 0, limit);
    $("reset").textContent = `Resets ${reset.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}`;
    $("leftN").textContent = String(limit - used); $("leftOf").textContent = `left of ${limit} this month`;
    $("fill").style.width = `${Math.round((used / limit) * 100)}%`;
    $("bar").setAttribute("aria-valuenow", used); $("bar").setAttribute("aria-valuemax", limit); $("bar").setAttribute("aria-label", `${used} of ${limit} AI credits used`);
    $("usedNote").textContent = `${used} used — 1 credit per summary, suggestion or tidy-up`;
  }
  const rows = KINDS.filter(([k]) => u.kinds[k] || k !== "insight" && k !== "tidy").map(([k, label]) => [label, u.kinds[k] ?? 0]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  $("kinds").replaceChildren(...rows.map(([label, n]) => { const d = document.createElement("div"); d.className = "kind"; d.innerHTML = `<span></span><span class="t"><i style="width:${Math.round((n / max) * 100)}%"></i></span><b>${n}</b>`; d.firstChild.textContent = label; return d; }));

  paintSync();

  // Settings
  const p = await getPrefs();
  $("asPopup").setAttribute("aria-pressed", p.openAs === "popup"); $("asPanel").setAttribute("aria-pressed", p.openAs === "panel");
  $("readSw").setAttribute("aria-checked", p.aiReadPages);
}

$("asPopup").onclick = () => setOpenAs("popup"); $("asPanel").onclick = () => setOpenAs("panel");
async function setOpenAs(openAs) { await api.storage.local.set({ openAs }); $("asPopup").setAttribute("aria-pressed", openAs === "popup"); $("asPanel").setAttribute("aria-pressed", openAs === "panel"); }   // the service worker applies it
$("readSw").onclick = async () => { const on = $("readSw").getAttribute("aria-checked") !== "true"; $("readSw").setAttribute("aria-checked", on); await api.storage.local.set({ aiReadPages: on }); };
$("topup").onclick = () => soon("Top-ups aren't available yet.");
$("history").onclick = () => soon("Credit history isn't available yet.");
$("logout").onclick = async () => { await signOut(); location.href = "login.html"; };
paint();
