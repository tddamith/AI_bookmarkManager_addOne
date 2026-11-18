import { $, AI, setSession, authRequest, googleAuth } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { initForms, validate, withBusy } from "./forms.js";
renderPanelHead($("head"));
initForms();
const status = (msg) => { $("status").textContent = msg; };

const ERRORS = { invalid: "Email or password is wrong.", rate_limited: "Too many attempts. Wait a few minutes and try again.", network: "Couldn't reach Stash. Check your connection and try again." };
/** Real login when a Stash API is configured; otherwise a local-only session (development without a backend). Never stores the password. */
async function signIn(email, password, remember) {
  if (!AI.endpoint) { await setSession({ email, remember, signedInAt: Date.now() }, remember); return null; }
  const r = await authRequest("login", { email, password, remember });
  if (!r.ok) return ERRORS[r.error] ?? ERRORS.network;
  await setSession({ email: r.user.email, name: r.user.name, token: r.token, plan: r.pro ? "pro" : "free", billing: r.billing, renews: r.renews, ends: r.ends, paid: r.pro, paidWith: r.pro ? "PayPal" : undefined, remember, signedInAt: Date.now() }, remember);
  return null;
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault(); status("");
  const email = $("email"), pw = $("password");
  if (!validate([
    { input: email, ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()), message: "Enter a full email" },
    { input: pw, ok: !!pw.value, message: "Enter your password" },
  ])) return;
  await withBusy(e.submitter, async () => {
    try { const err = await signIn(email.value.trim().toLowerCase(), pw.value, $("remember").checked); if (err) { status(err); return; } location.href = "home.html"; }
    catch { status(ERRORS.network); }
  });
});
const G_ERRORS = { not_configured: "Google sign-in isn't set up yet.", cancelled: "Google sign-in was cancelled.", invalid: "Google couldn't verify that account. Try again.", rate_limited: ERRORS.rate_limited, network: ERRORS.network };
$("google").addEventListener("click", (e) => withBusy(e.currentTarget, async () => {
  status("");
  const r = await googleAuth();
  if (!r.ok) { status(G_ERRORS[r.error] ?? ERRORS.network); return; }
  await setSession({ email: r.user.email, name: r.user.name, token: r.token, plan: r.pro ? "pro" : "free", billing: r.billing, renews: r.renews, ends: r.ends, paid: r.pro, paidWith: r.pro ? "PayPal" : undefined, isNew: r.isNew, remember: true, signedInAt: Date.now() });
  location.href = r.isNew ? "plans.html" : "home.html";      // same rule as sign-up: new accounts pick a plan, then onboarding
}));
$("forgot").addEventListener("click", (e) => { e.preventDefault(); status("Password reset isn't available yet."); });
