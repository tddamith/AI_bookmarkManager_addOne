import "./sync.js";   // bookmark sync (background)
// Toolbar icon opens the side panel (default) or a popup, per Profile > "Open Stash as" (storage.local.openAs).
async function applyMode() {
  const { openAs = "panel" } = await chrome.storage.local.get("openAs");
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: openAs === "panel" }).catch(() => {});
  await chrome.action.setPopup({ popup: openAs === "popup" ? "popup/home.html" : "" }).catch(() => {});
}
chrome.runtime.onInstalled.addListener(() => {
  applyMode();
  chrome.contextMenus.create({ id: "save-link", title: "Save to Stash", contexts: ["page", "link"] });
});
chrome.runtime.onStartup.addListener(applyMode);
applyMode();
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.openAs) applyMode(); });

// Keyboard shortcut (Ctrl/Cmd+Shift+Y) opens the panel in the current window.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-side-panel" && tab?.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl ?? tab?.url;
  if (url) await chrome.bookmarks.create({ title: info.selectionText || tab?.title || url, url });
});

// ── Visit tracking for Insights: count opens of pages you've saved (local only, 90 days) ──
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
chrome.tabs.onUpdated.addListener(async (_id, info, tab) => {
  if (info.status !== "complete" || !tab.url || !/^https?:/.test(tab.url)) return;
  try {
    let hits = await chrome.bookmarks.search({ url: tab.url });
    if (!hits.length) hits = await chrome.bookmarks.search({ url: tab.url.endsWith("/") ? tab.url.slice(0, -1) : tab.url + "/" });
    if (!hits.length) return;
    const u = normUrl(tab.url), now = Date.now();
    const { visits = [] } = await chrome.storage.local.get("visits");
    const last = visits[visits.length - 1];
    if (last && last.u === u && now - last.t < 30000) return;           // reload / duplicate event
    visits.push({ u, t: now });
    const cutoff = now - 90 * 864e5;
    const kept = visits.filter((v) => v.t > cutoff).slice(-5000);
    const { trackingSince } = await chrome.storage.local.get("trackingSince");
    await chrome.storage.local.set({ visits: kept, ...(trackingSince ? {} : { trackingSince: now }) });
  } catch {}
});
chrome.runtime.onInstalled.addListener(async () => { const { trackingSince } = await chrome.storage.local.get("trackingSince"); if (!trackingSince) await chrome.storage.local.set({ trackingSince: Date.now() }); });
