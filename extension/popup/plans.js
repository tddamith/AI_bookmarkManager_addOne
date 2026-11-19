import { $, PLAN, getSession, syncPlan, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";
renderPanelHead($("head"), "", { back: "home.html", light: true });
$("free").textContent = `Unlimited bookmarks · ${PLAN.freeAiPerMonth} AI suggestions a month · 1 device`;
const check = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#111"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#D4FA1E" stroke-width="2"/></svg>`;
$("perks").replaceChildren(...PLAN.perks.map(p => { const li = document.createElement("li"); li.insertAdjacentHTML("afterbegin", check); li.append(p); return li; }));
let billing = "yearly";
function paint() {
  $("monthly").setAttribute("aria-pressed", billing === "monthly");
  $("yearly").setAttribute("aria-pressed", billing === "yearly");
  $("yearly").textContent = `Yearly · save ${PLAN.yearlySavePct}%`;
  $("price").textContent = PLAN.price[billing];
  $("per").textContent = billing === "yearly" ? "/ year" : "/ month";
  $("was")?.remove();
  if (billing === "yearly") $("price").insertAdjacentHTML("beforebegin", `<s id="was" style="font-size:14px;opacity:.6;margin-right:6px" aria-label="Was ${PLAN.list.yearly}">${PLAN.list.yearly}</s>`);
  $("upgrade").href = `checkout.html?billing=${billing}`;
}
$("monthly").onclick = () => { billing = "monthly"; paint(); };
$("yearly").onclick = () => { billing = "yearly"; paint(); };
paint();

// Reflect the current plan: Free shows "Current plan"; a Pro user's CTA becomes a disabled "Current plan".
syncPlan().then(() => getSession()).then(async (s) => {
  if (!s) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;
  if (s.plan === "pro") { const b = $("upgrade"); b.removeAttribute("href"); b.setAttribute("aria-disabled", "true"); $("upgradeText").textContent = "Current plan"; b.classList.add("is-current"); }
  else if (s.isNew) $("continueFree").hidden = false;     // just signed up: Free continues into onboarding
  else $("freeNow").hidden = false;
});
