import { $, setSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
import { initForms, validate, withBusy } from "./forms.js";
renderPanelHead($("head"));
initForms();
const status = (msg) => { $("status").textContent = msg; };

// TODO(auth): replace with real backend call. Never persist the password.
async function signIn(email, remember) { await setSession({ email, remember, signedInAt: Date.now() }, remember); }

$("form").addEventListener("submit", async (e) => {
  e.preventDefault(); status("");
  const email = $("email"), pw = $("password");
  if (!validate([
    { input: email, ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()), message: "Enter a full email" },
    { input: pw, ok: !!pw.value, message: "Enter your password" },
  ])) return;
  await withBusy(e.submitter, async () => {
    try { await signIn(email.value.trim(), $("remember").checked); location.href = "home.html"; }
    catch { status("Couldn't log in. Check your connection and try again."); }
  });
});
$("google").addEventListener("click", () => status("Google sign-in isn't connected yet."));
$("forgot").addEventListener("click", (e) => { e.preventDefault(); status("Password reset isn't available yet."); });
