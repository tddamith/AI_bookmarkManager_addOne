import { $, setSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { initForms, validate, withBusy } from "./forms.js";
renderPanelHead($("head"));
initForms();
const status = (m) => { $("status").textContent = m; };

// TODO(auth): call real sign-up API. Never persist the password.
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
    await setSession({ email: email.value.trim(), name: name.value.trim(), plan: "free", isNew: true, remember: true, signedInAt: Date.now() });
      location.href = "plans.html";
    } catch { status("Couldn't create your account. Try again."); }
  });
});
$("google").addEventListener("click", () => status("Google sign-up isn't connected yet."));
