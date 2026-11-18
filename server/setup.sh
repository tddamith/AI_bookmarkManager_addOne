#!/usr/bin/env bash
# One-shot setup for the Stash API (accounts, Claude Haiku AI, PayPal, Google sign-in).
# Run from anywhere:   bash server/setup.sh
# It will: log you in to Cloudflare, create the KV storage, ask for your secrets, deploy the worker,
# and write the resulting URL into extension/popup/config.js (AI.endpoint).
# Re-running is safe: existing values are kept and you can skip any secret you already set.
set -euo pipefail
cd "$(dirname "$0")"
W="npx --yes wrangler"
say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

say "1/5  Log in to Cloudflare (opens your browser)"
$W whoami >/dev/null 2>&1 || $W login

say "2/5  Storage (KV)"
if grep -q "REPLACE_WITH_KV_NAMESPACE_ID" wrangler.toml; then
  OUT="$($W kv namespace create KV 2>&1 | tee /dev/stderr)"
  ID="$(printf '%s' "$OUT" | grep -Eo 'id = "[0-9a-f]{32}"' | head -1 | grep -Eo '[0-9a-f]{32}')" || true
  [ -n "${ID:-}" ] || { echo "Could not read the KV id above. Paste it into wrangler.toml (id = ...) and re-run."; exit 1; }
  sed -i.bak "s/REPLACE_WITH_KV_NAMESPACE_ID/$ID/" wrangler.toml && rm -f wrangler.toml.bak
  echo "KV namespace id saved to wrangler.toml"
else
  echo "KV id already set."
fi

say "3/5  Secrets (press Enter to skip one you already set)"
ask_secret() {   # name, hint
  printf '\n%s — %s\n' "$1" "$2"; read -r -s -p "Value (hidden, Enter to skip): " V; echo
  if [ -n "$V" ]; then printf '%s' "$V" | $W secret put "$1" >/dev/null && echo "$1 saved"; else echo "$1 skipped"; fi
}
ask_secret ANTHROPIC_API_KEY "from console.anthropic.com > API keys"
ask_secret PAYPAL_CLIENT_ID "PayPal developer dashboard > your app (sandbox first)"
ask_secret PAYPAL_SECRET "same app, Secret key"

say "4/5  Deploy"
OUT="$($W deploy 2>&1 | tee /dev/stderr)"
URL="$(printf '%s' "$OUT" | grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' | head -1)" || true
[ -n "${URL:-}" ] || { echo "Deploy finished but I couldn't find the URL. Copy it and set AI.endpoint in extension/popup/config.js yourself."; exit 1; }

say "5/5  Point the extension at it"
CFG="../extension/popup/config.js"
sed -i.bak -E "s#(export const AI = \{ endpoint: )\"[^\"]*\"#\1\"$URL\"#" "$CFG" && rm -f "$CFG.bak"
grep -n "export const AI" "$CFG"

cat <<EOF

Done. Your API link: $URL

Still to do by hand:
  - Reload the extension at chrome://extensions
  - PayPal webhook: add $URL/paypal/webhook in your PayPal app, then:
      cd server && npx wrangler secret put PAYPAL_WEBHOOK_ID && npx wrangler deploy
  - Google sign-in (optional): set GOOGLE_CLIENT_ID in wrangler.toml and GOOGLE.clientId in config.js, then redeploy
Quick check:  curl $URL/auth/me    ->  {"error":"unauthorized"} means it is live.
EOF
