import { api, BRAND_DARK } from "./config.js";
const BRAND_LIGHT = `<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="#111111"/></svg>`;
/** Header bar: [Back] Stash mark on the left, extras + Close on the right. opts: { back: "home.html", light: true } */
export function renderPanelHead(el, extra = "", opts = {}) {
  el.className = "panel-head";
  const back = opts.back ? `<a class="btn icon-round outline back-btn" href="${opts.back}" aria-label="Back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></a>` : "";
  el.innerHTML = `<div class="brand">${back}<span class="logo${opts.light ? " light" : ""}">${opts.light ? BRAND_LIGHT : BRAND_DARK}</span><span class="wordmark">STASH</span></div>
    <div class="head-right">${extra}<button type="button" class="panel-close" aria-label="Close side panel"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  el.querySelector(".panel-close").addEventListener("click", async () => {
    try { const w = await api.windows.getCurrent(); await api.sidePanel.close({ windowId: w.id }); } catch { window.close(); }
  });
}
