import { $, PLAN, AI, getSession, setSession, renewDate, authHeaders, syncPlan } from "./config.js";
import { withBusy } from "./forms.js";
import { renderPanelHead } from "./panel.js";
renderPanelHead($("head"), "", { back: "plans.html" });
const billing = new URLSearchParams(location.search).get("billing") === "monthly" ? "monthly" : "yearly";
const label = billing === "yearly" ? "Yearly" : "Monthly";
$("plan").textContent = `${label} plan`;
$("item").textContent = `Pro · ${label}`;
$("price").textContent = PLAN.price[billing];
$("tax").textContent = PLAN.tax; $("total").textContent = PLAN.price[billing];
$("renew").textContent = `${billing === "yearly" ? `${PLAN.yearlySavePct}% off ${PLAN.list.yearly}. ` : ""}Renews on ${renewDate(billing)}. Cancel any time.`;
$("promoForm").addEventListener("submit", (e) => { e.preventDefault(); $("status").textContent = "Promo codes aren't available yet."; });

// PayPal subscription: the worker creates it, PayPal's own page takes the payment, and the PayPal webhook marks
// this install Pro. We never mark Pro from the client alone, so nobody can get it without paying.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pay(btn) {
  const status = $("status");
  if (!AI.endpoint) { status.textContent = "Payments aren't set up yet."; return; }
  [$("paypal"), $("card")].forEach((b) => (b.disabled = true));
  await withBusy(btn, async () => {
    try {
      const r = await fetch(AI.endpoint + "/paypal/create", { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ billing }) });
      if (r.status === 401) { status.textContent = "Please log in again to subscribe."; return; }
      const { approveUrl } = r.ok ? await r.json() : {};
      if (!approveUrl) throw new Error("create");
      await (globalThis.browser ?? chrome).tabs.create({ url: approveUrl });
      status.textContent = "Finish paying in the PayPal tab. This page updates by itself.";
      for (let i = 0; i < 200; i++) {                       // wait up to ~10 minutes
        await sleep(3000);
        if (await syncPlan()) { const s = await getSession(); await setSession({ ...s, billing, paidWith: "PayPal" }, s?.remember !== false); location.href = "success.html"; return; }
      }
      status.textContent = "We haven't seen a payment yet. If you paid, reopen Plans in a minute.";
    } catch { status.textContent = "Couldn't start PayPal. Check your connection and try again."; }
  });
  [$("paypal"), $("card")].forEach((b) => (b.disabled = false));
}
$("paypal").onclick = (e) => pay(e.currentTarget);
$("card").onclick = (e) => pay(e.currentTarget);   // PayPal checkout also accepts debit/credit cards without a PayPal account
