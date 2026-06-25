"""A2 repair: set setup_completed/onboarding_completed for users who already have meaningful data
(an activated Plaid persona OR a saved goal) but stale flags — so they aren't trapped in onboarding.
Idempotent + safe: only flips flags to true for users WITH data; never the reverse. Service-role only."""
import os, json, urllib.request, urllib.error

U = os.environ["SUPABASE_URL"].rstrip("/"); K = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": K, "Authorization": "Bearer " + K, "Content-Type": "application/json",
     "User-Agent": "Mozilla/5.0"}

def get(path):
    req = urllib.request.Request(U + "/rest/v1/" + path, headers=H)
    return json.load(urllib.request.urlopen(req, timeout=30))

def patch(path, body):
    req = urllib.request.Request(U + "/rest/v1/" + path, data=json.dumps(body).encode(),
                                 method="PATCH", headers={**H, "Prefer": "return=minimal"})
    return urllib.request.urlopen(req, timeout=30).status

# users with meaningful data
persona_users = {r["user_id"] for r in get("analytics_user_events?subject_kind=eq.plaid_persona&select=user_id") if r.get("user_id")}
goal_users = {r["user_id"] for r in get("goals?select=user_id") if r.get("user_id")}
meaningful = persona_users | goal_users
print(f"users with persona={len(persona_users)} goal={len(goal_users)} union={len(meaningful)}")

# of those, which have a stale flag?
fixed = 0
for uid in sorted(meaningful):
    rows = get(f"profiles?id=eq.{uid}&select=id,setup_completed,onboarding_completed")
    if not rows:
        continue
    p = rows[0]
    if p.get("setup_completed") is not True or p.get("onboarding_completed") is not True:
        patch(f"profiles?id=eq.{uid}", {"setup_completed": True, "onboarding_completed": True})
        fixed += 1
print(f"backfilled {fixed} user(s) with stale flags")
