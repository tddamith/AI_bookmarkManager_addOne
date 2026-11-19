import { $, AI, setSession, authRequest, googleAuth } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { initForms, validate, withBusy } from "./forms.js";
renderPanelHead($("head"));
initForms();
const status = (m) => { $("status").textContent = m; };

const ERRORS = { exists: "An account with this email already exists. Log in instead.", rate_limited: "Too many attempts. Try again in a bit.", bad_email: "Enter a full email.", bad_password: "Use 8 to 200 characters.", bad_name: "Enter your name.", network: "Couldn't reach Stash. Check your connection and try again." };
// Creates the account on the Stash API when one is configured (local-only otherwise). Never stores the password.
$("form").addEventListener("submit", async (e) => {
  e.preventDefault(); status("");
  const name = $("name"), email = $("email"), pw = $("password"), terms = $("terms");
  if (!validate([
    { input: name, ok: !!name.value.trim(), message: "Enter your name" },
    { input: email, ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()), message: "Enter a full email" },
    { input: pw, ok: pw.value.length >= 8, message: "Use at least 8 characters" },
  ])) return;
  if (!terms.checked) { status("Agree to the Terms and Privacy Policy to continue."); terms.focus(); return; }
  await withBusy(e.submitter, async () => {
    try {
    const base = { email: email.value.trim().toLowerCase(), name: name.value.trim(), plan: "free", isNew: true, remember: true, signedInAt: Date.now() };
      if (AI.endpoint) {
        const r = await authRequest("signup", { name: base.name, email: base.email, password: pw.value });
        if (!r.ok) { status(ERRORS[r.error] ?? ERRORS.network); return; }
        base.token = r.token; base.email = r.user.email; base.name = r.user.name; base.verified = !!r.user.verified;
      }
      await setSession(base);
      location.href = base.verified === false ? "verify.html" : "plans.html";
    } catch { status("Couldn't create your account. Try again."); }
  });
});
const G_ERRORS = { not_configured: "Google sign-up isn't set up yet.", cancelled: "Google sign-up was cancelled.", invalid: "Google couldn't verify that account. Try again.", rate_limited: ERRORS.rate_limited, network: ERRORS.network };
$("google").addEventListener("click", (e) => withBusy(e.currentTarget, async () => {
  status("");
  if (!$("terms").checked) { status("Agree to the Terms and Privacy Policy to continue."); $("terms").focus(); return; }
  const r = await googleAuth();
  if (!r.ok) { status(G_ERRORS[r.error] ?? ERRORS.network); return; }
  // An existing Google/Stash account just logs in; a new one is set up like a normal sign-up.
  await setSession({ email: r.user.email, name: r.user.name, token: r.token, plan: r.pro ? "pro" : "free", billing: r.billing, renews: r.renews, ends: r.ends, paid: r.pro, paidWith: r.pro ? "PayPal" : undefined, isNew: r.isNew, remember: true, signedInAt: Date.now() });
  location.href = r.isNew ? "plans.html" : "home.html";
}));
