// Stash Pro pricing. Yearly is a 20% promo off the $94.99 list price. Keep in sync with the PayPal billing plans (server/worker.js).
export const PLAN = {
  price: { monthly: "$6.99", yearly: "$75.99" },
  list: { yearly: "$94.99" },
  yearlySavePct: 20,
  freeAiPerMonth: 50,                 // match FREE_LIMIT in the worker
  tax: "Included", perks: ["Unlimited AI suggestions", "One-tap tidy-up", "For you picks on every site", "Sync on all devices"],
};
/** "Renews on Dec 18, 2026" date for a billing period starting today. */
export function renewDate(billing, from = new Date()) {
  const d = new Date(from); billing === "yearly" ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
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
export const AI = { endpoint: "http://127.0.0.1:8000", maxChars: 12000 };   // local FastAPI backend (AI_bookmarkManager_api)

/** Authorization header for the Stash API (empty when signed out or running without a backend). */
export async function authHeaders() {
  const s = await getSession();
  return s?.token ? { authorization: `Bearer ${s.token}` } : {};
}
/** Google sign-in: a "Web application" OAuth client whose authorized redirect URI is https://<extension-id>.chromiumapp.org/ (see identity.getRedirectURL()). */
export const GOOGLE = { clientId: "" };
/** Opens Google's account chooser, gets an ID token (OIDC, nonce-bound) and exchanges it for a Stash session. */
export async function googleAuth() {
  if (!AI.endpoint || !GOOGLE.clientId) return { ok: false, error: "not_configured" };
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: GOOGLE.clientId, response_type: "id_token", redirect_uri: api.identity.getRedirectURL(), scope: "openid email profile", nonce, prompt: "select_account" });
  let redirect;
  try { redirect = await api.identity.launchWebAuthFlow({ url, interactive: true }); } catch { return { ok: false, error: "cancelled" }; }
  const idToken = new URLSearchParams(new URL(redirect).hash.slice(1)).get("id_token");
  if (!idToken) return { ok: false, error: "cancelled" };
  try {
    const r = await fetch(apiUrl("/auth/google"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken, nonce }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error ?? "network" };
    return { ok: true, isNew: !!j.isNew, token: j.token, user: j.user, pro: !!j.pro, billing: j.billing ?? null, renews: j.renews ?? null, ends: j.ends ?? null };
  } catch { return { ok: false, error: "network" }; }
}
const apiUrl = (path) => AI.endpoint + path;
/** Sign in or sign up against the Stash API. Returns { ok, session } or { ok:false, error } (error: invalid | exists | rate_limited | bad_* | network). */
export async function authRequest(kind, body) {
  try {
    const r = await fetch(apiUrl(`/auth/${kind}`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error ?? "network" };
    return { ok: true, token: j.token, user: j.user, pro: !!j.pro, billing: j.billing ?? null, renews: j.renews ?? null, ends: j.ends ?? null };
  } catch { return { ok: false, error: "network" }; }
}
/** Log out: revoke the token on the server (best effort), then clear the local session. */
export async function signOut() {
  try { if (AI.endpoint) await fetch(apiUrl("/auth/logout"), { method: "POST", headers: await authHeaders() }); } catch {}
  await clearSession();
}

/** Pro status from the server (PayPal webhook is the source of truth). Updates the session; returns true if Pro. Offline/not set up: leaves it alone. */
export async function syncPlan() {
  if (!AI.endpoint) return null;
  const s = await getSession(); if (!s) return null;
  try {
    const r = await fetch(AI.endpoint + "/paypal/status", { headers: await authHeaders() });
    if (r.status === 401) { await clearSession(); return null; }       // token revoked or expired: sign in again
    if (!r.ok) return null;
    const { pro, billing, renews, ends } = await r.json();
    if (pro && (s.plan !== "pro" || s.renews !== renews || s.ends !== ends)) await setSession({ ...s, plan: "pro", billing, paidWith: "PayPal", paid: true, renews, ends }, s.remember !== false);
    else if (!pro && s.plan === "pro" && s.paid) await setSession({ ...s, plan: "free", paid: false }, s.remember !== false);   // cancelled / lapsed
    return pro;
  } catch { return null; }
}

/** Local AI usage for the Profile screen (the worker's `used`/`limit` are the truth for the total; kinds are for the breakdown). */
const monthKey = () => new Date().toISOString().slice(0, 7);   // UTC, same as the worker's quota month
export async function trackAi(kind, used, limit) {
  const { aiUsage } = await api.storage.local.get("aiUsage");
  const u = aiUsage?.month === monthKey() ? aiUsage : { month: monthKey(), kinds: {} };
  u.kinds[kind] = (u.kinds[kind] ?? 0) + 1;
  if (Number.isInteger(used)) u.used = used;
  if (Number.isInteger(limit)) u.limit = limit;
  await api.storage.local.set({ aiUsage: u });
}
export async function getAiUsage() {
  const { aiUsage } = await api.storage.local.get("aiUsage");
  return aiUsage?.month === monthKey() ? aiUsage : { month: monthKey(), kinds: {} };
}
/** Settings (defaults: panel mode, AI may read page content). */
export async function getPrefs() {
  const { openAs = "panel", aiReadPages = true } = await api.storage.local.get(["openAs", "aiReadPages"]);
  return { openAs, aiReadPages };
}
