import { $, api, getSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
renderPanelHead($("head"), "", { light: true });
getSession().then((s) => { if (!s) location.href = "login.html"; });
$("ready").addEventListener("click", async (e) => { e.preventDefault(); await api.storage.local.set({ gs: { on: true, at: Date.now() } }); location.href = "home.html"; });

/* Show the real shortcut for "open the panel" (users can change it in the browser). */
function parts(sc) {
  if (!sc) return [];
  if (sc.includes("+")) return sc.split("+").map((k) => k.trim()).filter(Boolean);
  return [...sc];                                   // macOS symbols, e.g. ⌘⇧Y
}
async function paintKeys() {
  const cmds = await api.commands.getAll();
  const open = cmds.find((c) => c.name === "open-side-panel");
  const keys = parts(open?.shortcut);
  $("keys").replaceChildren(...(keys.length ? keys.map((k) => Object.assign(document.createElement("kbd"), { textContent: k })) : [Object.assign(document.createElement("span"), { className: "unset", textContent: "Not set yet" })]));
}
paintKeys();
$("change").addEventListener("click", () => api.tabs.create({ url: "chrome://extensions/shortcuts" }));
addEventListener("focus", paintKeys);                // refresh after changing it in another tab
