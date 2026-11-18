// Open items from the spec: set real values before launch.
export const PLAN = {
  price: { monthly: "[PRICE]", yearly: "[PRICE]" },
  yearlySavePct: "[X]",
  freeAiPerMonth: "[N]",
  tax: "[TAX]", total: "[TOTAL]", renewDate: "[DATE]",
  perks: ["Unlimited AI suggestions", "One-tap tidy-up", "For you picks on every site", "Sync on all devices"],
};
export const api = globalThis.browser ?? globalThis.chrome;
export const $ = (id) => document.getElementById(id);
export const BRAND = `<span class="logo"><svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="#111111"/></svg></span><span class="wordmark">STASH</span>`;
export const BRAND_DARK = `<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="#D4FA1E"/></svg>`;

// Session: "Keep me logged in" -> storage.local; otherwise storage.session (cleared when the browser closes).
export async function getSession() {
  const s = (await api.storage.session.get("session")).session;
  return s ?? (await api.storage.local.get("session")).session;
}
export async function setSession(session, remember = true) {
  await clearSession();
  await (remember ? api.storage.local : api.storage.session).set({ session });
}
export async function clearSession() { await api.storage.session.remove("session"); await api.storage.local.remove("session"); }

// AI summaries (Claude Haiku 5.5, called through YOUR proxy so the API key never ships in the extension).
// Leave endpoint empty to use the on-device summary instead. See server/worker.js.
export const AI = { endpoint: "", maxChars: 12000 };
