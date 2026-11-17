// Site icon for a bookmark link (the browser's own favicon cache). Falls back to a letter chip.
import { api } from "./config.js";
const PALETTE = [["#111111", "#D4FA1E"], ["#C92A2A", "#FFFFFF"], ["#111111", "#FFFFFF"], ["#A6C3DD", "#111111"], ["#D4FA1E", "#111111"], ["#C9B597", "#111111"]];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

export function faviconUrl(pageUrl, size = 32) {
  const u = new URL(api.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl); u.searchParams.set("size", String(size));
  return u.toString();
}
function letter(host) {
  const [bg, fg] = PALETTE[hash(host) % PALETTE.length];
  const s = document.createElement("span"); s.className = "lt"; s.textContent = (host[0] || "?").toUpperCase(); s.style.background = bg; s.style.color = fg; return s;
}
/** <span class="fav"> with the site's icon. opts: { small: true } */
export function favicon(pageUrl, opts = {}) {
  const host = hostOf(pageUrl);
  const box = document.createElement("span"); box.className = "fav" + (opts.small ? " sm" : ""); box.setAttribute("aria-hidden", "true");
  const img = document.createElement("img"); img.alt = ""; img.width = img.height = opts.small ? 16 : 20; img.loading = "lazy"; img.src = faviconUrl(pageUrl, 32);
  img.onerror = () => img.replaceWith(letter(host));
  img.onload = () => { if (img.naturalWidth <= 1) img.replaceWith(letter(host)); };
  box.append(img); return box;
}
