import { $, AI, api, clearSession, getSession, setSession, verifyRequest } from "./config.js";
import { renderPanelHead } from "./panel.js";
renderPanelHead($("head"), "", { back: "signup.html" });

const input = $("otp"), boxes = [...document.querySelectorAll("#boxes .box")], msg = $("msg"), btn = $("verify");
const RESEND_SECS = 45;
let session, timer, secs = 0, busy = false;

const say = (text, err = false) => { msg.textContent = text; msg.classList.toggle("err", err); $("boxes").classList.toggle("invalid", err); };
const plural = (n) => `${n} ${n === 1 ? "try" : "tries"} left`;
const ERRORS = {
  expired: "That code expired. Send a new one.", too_many_attempts: "Too many wrong codes. Send a new one.", rate_limited: "Too many requests. Try again in a bit.",
  send_failed: "Couldn't send the email. Try again.", network: "Couldn't reach Stash. Check your connection and try again.", unauthorized: "Your session ended. Log in again.",
};

function paint() {
  const d = input.value;
  boxes.forEach((b, i) => { b.textContent = d[i] ?? ""; b.classList.toggle("active", document.activeElement === input && i === Math.min(d.length, 5)); });
  btn.disabled = d.length !== 6 || busy;
}
function countdown(n) {
  clearInterval(timer); secs = n;
  const tick = () => {
    $("resend").hidden = secs > 0;
    $("wait").textContent = secs > 0 ? `Resend in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "";
    if (secs-- <= 0) clearInterval(timer);
  };
  tick(); timer = setInterval(tick, 1000);
}

/** Email a fresh code. note: true = "new code" message (Resend), false = silent, null = first load of the page. */
async function sendCode(note) {
  const r = await verifyRequest("verify/send");
  if (r.ok) { if (r.verified) return success(); countdown(r.resendIn ?? RESEND_SECS); if (note) say("A new code is on its way."); return; }
  if (r.error === "rate_limited" && r.retryIn) { countdown(r.retryIn); if (note === null) return; }   // null = opening the page: a code was already sent recently
  say(ERRORS[r.error] ?? ERRORS.network, true);
}

async function success() {
  await setSession({ ...session, verified: true }, session.remember !== false);
  const name = (session.name || "").split(" ")[0];
  $("doneLead").textContent = name ? `You’re all set, ${name}. Your account is ready.` : "You’re all set. Your account is ready.";
  $("go").href = session.isNew ? "plans.html" : "home.html";
  $("enter").hidden = true; $("done").hidden = false; $("go").focus();
}

input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 6); say(""); paint(); });
input.addEventListener("focus", paint); input.addEventListener("blur", paint);
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (input.value.length !== 6 || busy) return;
  busy = true; btn.setAttribute("aria-busy", "true"); paint();
  const r = await verifyRequest("verify", { code: input.value });
  busy = false; btn.removeAttribute("aria-busy");
  if (r.ok) return success();
  if (r.error === "wrong_code") say(`That code doesn’t match.${Number.isInteger(r.triesLeft) ? " " + plural(r.triesLeft) + "." : ""}`, true);
  else say(ERRORS[r.error] ?? ERRORS.network, true);
  if (r.error === "expired" || r.error === "too_many_attempts") $("resend").hidden = false, countdown(0);
  paint(); input.focus(); input.select();
});
$("resend").addEventListener("click", async (e) => {
  if (e.currentTarget.getAttribute("aria-busy") === "true") return;
  e.currentTarget.setAttribute("aria-busy", "true"); input.value = ""; paint(); say("");
  await sendCode(true); e.currentTarget.removeAttribute("aria-busy"); input.focus();
});
$("change").addEventListener("click", async (e) => {      // "Change email": back to sign-up with the session cleared
  e.preventDefault(); await clearSession(); location.href = "signup.html";
});

(async () => {
  session = await getSession();
  if (!session) { location.href = "login.html"; return; }
  if (!AI.endpoint || session.verified !== false) { location.href = session.isNew ? "plans.html" : "home.html"; return; }
  $("email").textContent = session.email;
  paint(); input.focus();
  await sendCode(null);      // emails the code; if one went out under 45s ago the server says when we can resend
})();
