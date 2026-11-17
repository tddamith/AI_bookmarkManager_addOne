import { $, PLAN, getSession, setSession } from "./config.js";
import { withBusy } from "./forms.js";
import { renderPanelHead } from "./panel.js";
renderPanelHead($("head"), "", { back: "plans.html" });
const billing = new URLSearchParams(location.search).get("billing") === "monthly" ? "monthly" : "yearly";
const label = billing === "yearly" ? "Yearly" : "Monthly";
$("plan").textContent = `${label} plan`;
$("item").textContent = `Pro · ${label}`;
$("price").textContent = PLAN.price[billing];
$("tax").textContent = PLAN.tax; $("total").textContent = PLAN.total;
$("renew").textContent = `Renews on ${PLAN.renewDate}. Cancel any time.`;
$("promoForm").addEventListener("submit", (e) => { e.preventDefault(); $("status").textContent = "Promo codes aren't available yet."; });

// TODO(payments): replace with PayPal's official checkout button + server-side
// order verification. This stub marks the account Pro WITHOUT charging — dev only.
async function pay(method, btn) {
  const other = method === "PayPal" ? $("card") : $("paypal");
  other.disabled = true;
  await withBusy(btn, async () => {
  const session = await getSession();
  await setSession({ ...session, plan: "pro", billing, paidWith: method }, session?.remember !== false);
  location.href = "success.html";
  });
  other.disabled = false;
}
$("paypal").onclick = (e) => pay("PayPal", e.currentTarget);
$("card").onclick = (e) => pay("Card", e.currentTarget);
