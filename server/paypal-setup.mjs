// One-time setup: creates the Stash Pro product and its two PayPal subscription plans
// (monthly $6.99, yearly $75.99), then prints the plan IDs for wrangler.toml.
//
//   PAYPAL_CLIENT_ID=... PAYPAL_SECRET=... PAYPAL_ENV=sandbox node paypal-setup.mjs          # print the IDs
//   PAYPAL_CLIENT_ID=... PAYPAL_SECRET=... PAYPAL_ENV=sandbox node paypal-setup.mjs --write  # also fill wrangler.toml
//
// Use the SANDBOX credentials first (developer.paypal.com > Apps & Credentials). For live, re-run with
// PAYPAL_ENV=live and the live credentials: plans are per environment, so you get different IDs.
// Run it once per environment. Running it again creates duplicate plans (harmless, but use the newest IDs).
import { readFile, writeFile } from "node:fs/promises";

const { PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV = "sandbox" } = process.env;
if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) { console.error("Set PAYPAL_CLIENT_ID and PAYPAL_SECRET (and PAYPAL_ENV=sandbox|live)."); process.exit(1); }
const BASE = PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const PLANS = [
  { key: "MONTHLY", name: "Stash Pro — Monthly", unit: "MONTH", price: "6.99", placeholder: "REPLACE_WITH_MONTHLY_PLAN_ID" },
  { key: "YEARLY", name: "Stash Pro — Yearly", unit: "YEAR", price: "75.99", placeholder: "REPLACE_WITH_YEARLY_PLAN_ID" },
];

async function token() {
  const r = await fetch(`${BASE}/v1/oauth2/token`, { method: "POST", headers: { authorization: "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!r.ok) throw new Error(`Could not get a PayPal token (${r.status}). Check the client ID/secret and that PAYPAL_ENV matches them.`);
  return (await r.json()).access_token;
}
const call = async (t, path, body) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json", prefer: "return=representation" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} failed (${r.status}): ${JSON.stringify(j.details ?? j.message ?? j)}`);
  return j;
};

const t = await token();
console.log(`PayPal ${PAYPAL_ENV}: creating product…`);
const product = await call(t, "/v1/catalogs/products", { name: "Stash Pro", description: "Stash AI bookmark manager — Pro subscription", type: "SERVICE", category: "SOFTWARE" });

const ids = {};
for (const p of PLANS) {
  console.log(`Creating ${p.name} ($${p.price}/${p.unit.toLowerCase()})…`);
  const plan = await call(t, "/v1/billing/plans", {
    product_id: product.id, name: p.name, status: "ACTIVE",
    billing_cycles: [{ frequency: { interval_unit: p.unit, interval_count: 1 }, tenure_type: "REGULAR", sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: p.price, currency_code: "USD" } } }],
    payment_preferences: { auto_bill_outstanding: true, setup_fee: { value: "0", currency_code: "USD" }, setup_fee_failure_action: "CANCEL", payment_failure_threshold: 3 },
  });
  ids[p.key] = plan.id;
}

console.log(`\nDone. Put these in server/wrangler.toml under [vars]:\n\nPAYPAL_ENV = "${PAYPAL_ENV}"\nPAYPAL_PLAN_MONTHLY = "${ids.MONTHLY}"\nPAYPAL_PLAN_YEARLY = "${ids.YEARLY}"\n`);

if (process.argv.includes("--write")) {
  const file = new URL("./wrangler.toml", import.meta.url);
  let toml = await readFile(file, "utf8");
  for (const p of PLANS) toml = toml.replace(new RegExp(`(PAYPAL_PLAN_${p.key}\\s*=\\s*")[^"]*(")`), `$1${ids[p.key]}$2`);
  toml = toml.replace(/(PAYPAL_ENV\s*=\s*")[^"]*(")/, `$1${PAYPAL_ENV}$2`);
  await writeFile(file, toml);
  console.log("wrangler.toml updated.");
}
