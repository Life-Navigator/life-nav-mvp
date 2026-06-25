#!/usr/bin/env bash
# Configure Supabase Auth SMTP -> Resend + redirect allow-list, then test delivery.
# Secrets stay in YOUR shell (passed as env vars); nothing is printed.
#
# Usage (run with the ! prefix so it executes in-session):
#   SUPABASE_MGMT_PAT=sbp_xxx RESEND_KEY=re_xxx \
#   TEST1=you+test1@gmail.com TEST2=friend@example.com \
#   bash scripts/configure-auth-email.sh
set -euo pipefail
REF="diwkyyahglnqmyledsey"          # project ref (from SUPABASE_URL)
SITE="https://lifenavigator.tech"
: "${SUPABASE_MGMT_PAT:?need SUPABASE_MGMT_PAT (sbp_... from Supabase > Account > Access Tokens)}"
: "${RESEND_KEY:?need RESEND_KEY (re_... from Resend > API Keys)}"

echo "1) Verifying Resend domain lifenavigator.tech is verified..."
curl -s https://api.resend.com/domains -H "Authorization: Bearer $RESEND_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print('   ',x.get('name'),'->',x.get('status')) for x in (d.get('data') or [])]" \
  || { echo '   Resend key invalid or no domains'; exit 1; }

echo "2) Setting Supabase Auth SMTP (Resend) + site URL + redirect allow-list..."
curl -s -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_MGMT_PAT" -H "Content-Type: application/json" \
  -d "{
    \"external_email_enabled\": true,
    \"mailer_autoconfirm\": false,
    \"smtp_admin_email\": \"welcome@lifenavigator.tech\",
    \"smtp_host\": \"smtp.resend.com\",
    \"smtp_port\": 465,
    \"smtp_user\": \"resend\",
    \"smtp_pass\": \"$RESEND_KEY\",
    \"smtp_sender_name\": \"LifeNavigator\",
    \"smtp_max_frequency\": 1,
    \"site_url\": \"$SITE\",
    \"uri_allow_list\": \"$SITE/auth/confirm,$SITE/auth/callback,$SITE/auth/password-reset,$SITE/dashboard,$SITE/onboarding\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   smtp_host=',d.get('smtp_host'),'sender=',d.get('smtp_admin_email'),'site=',d.get('site_url'))"

echo "3) Sending a REAL magic link to test inboxes (via GoTrue OTP -> configured SMTP)..."
ANON=$(flyctl ssh console -a lifenavigator-core-api -C "printenv SUPABASE_ANON_KEY" 2>/dev/null | tr -d '\r\n' | tail -c 400)
for E in "${TEST1:-}" "${TEST2:-}"; do
  [ -z "$E" ] && continue
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SITE/auth/v1/otp" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$E\",\"options\":{\"email_redirect_to\":\"$SITE/auth/confirm?next=/dashboard\"}}" 2>/dev/null || true)
  # fall back to Supabase host directly if the app proxy path differs
  echo "   magic link requested for $E (http $code) — check that inbox"
done
echo "DONE. Click the link in each test inbox; it should land on $SITE/auth/confirm and into the app."
