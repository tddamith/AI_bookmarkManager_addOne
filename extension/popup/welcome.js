import { $, api, getSession, setSession, requireVerified } from "./config.js";
import { renderPanelHead } from "./panel.js";

renderPanelHead($("head"), `<a id="skip" class="skip" href="home.html">Skip</a>`, { light: true });

// Mark onboarding as seen on any choice so Home stops sending new users here.
async function done(startGuide) {
  const s = await getSession(); if (s) await setSession({ ...s, isNew: false }, s.remember !== false);
  if (startGuide) await api.storage.local.set({ gs: { on: true, at: Date.now() } });   // "Getting started" card on Home
}
for (const id of ["skip", "fresh", "import"]) $(id).addEventListener("click", async (e) => { e.preventDefault(); const href = e.currentTarget.href; await done(e.currentTarget.id === "fresh"); location.href = href; });

getSession().then(async (s) => {
  if (!s) { location.href = "login.html"; return; }
  if (!(await requireVerified())) return;
  const first = (s.name || "").trim().split(/\s+/)[0];
  $("h1").textContent = `${first ? `Hi ${first}, ready` : "Ready"} to set up Stash?`;
});
