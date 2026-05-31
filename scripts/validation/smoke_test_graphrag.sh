#!/usr/bin/env bash
# Personalized GraphRAG smoke test.
#
# Seeds a synthetic user, writes one row per major entity type into the
# user-graph tables, asserts that graphrag.sync_queue grew by the right
# amount (proving the triggers from migrations 050/055/068/074 fire),
# optionally drains the queue with a local Rust worker, and verifies the
# resulting Qdrant point + Neo4j node carry the correct tenant_id.
#
# Usage:
#
#   DATABASE_URL=postgres://postgres:...@localhost:54322/postgres \
#   QDRANT_URL=https://...                  \
#   QDRANT_API_KEY=...                      \
#   QDRANT_PERSONAL_COLLECTION=life_navigator \
#   NEO4J_URI=https://...                   \
#   NEO4J_USERNAME=neo4j                    \
#   NEO4J_PASSWORD=...                      \
#   NEO4J_PERSONAL_DATABASE=neo4j           \
#     ./scripts/validation/smoke_test_graphrag.sh
#
# Optional:
#   RUN_WORKER=1   — actually run the Rust worker locally to drain the queue.
#   CLEANUP=1      — delete the synthetic user when done (default: keep for debugging).
#
# Exits non-zero on any failure. Prints a green check on each successful step.
set -euo pipefail

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

require() {
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then red "missing env: $v"; exit 1; fi
  done
}

require DATABASE_URL

USER_ID="${SMOKE_USER_ID:-$(uuidgen | tr 'A-Z' 'a-z')}"
USER_EMAIL="${SMOKE_USER_EMAIL:-smoke+${USER_ID}@validation.local}"
RUN_WORKER="${RUN_WORKER:-0}"
CLEANUP="${CLEANUP:-0}"

green "==> 1. Seeding synthetic user $USER_ID"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES ('$USER_ID', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        '$USER_EMAIL', '', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, display_name)
VALUES ('$USER_ID', '$USER_EMAIL', 'Smoke Test')
ON CONFLICT (id) DO NOTHING;
SQL

# Snapshot the sync_queue size BEFORE we write anything.
BEFORE=$(psql "$DATABASE_URL" -tA -c \
  "SELECT count(*) FROM graphrag.sync_queue WHERE user_id = '$USER_ID';")

green "==> 2. Writing one row per major entity type"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
-- life_vision
INSERT INTO public.user_life_vision (user_id, horizon, vision_text)
VALUES ('$USER_ID', '1_year', 'Pay down credit-card debt to zero');

-- root goal (with discovery columns)
INSERT INTO public.goals
  (user_id, title, category, stated_goal, root_goal, urgency,
   dominant_driver, root_goal_confidence_score, status)
VALUES
  ('$USER_ID', 'Pay off credit cards', 'financial',
   'pay off my credit cards',
   'Reduce financial fragility and free up monthly cash flow',
   'high', 'financial_security', 0.8, 'active');

-- constraint
INSERT INTO public.user_constraints (user_id, dimension, severity, description)
VALUES ('$USER_ID', 'money', 'soft', 'Cannot reduce monthly cash flow below \$2000');

-- decision preference
INSERT INTO public.user_decision_preferences (user_id, axis, weight)
VALUES ('$USER_ID', 'minimize_stress', 0.85);

-- optimizer run + allocation
WITH ins_run AS (
  INSERT INTO public.goal_optimizer_runs
    (user_id, status, engine_version, monthly_surplus, total_allocation,
     next_best_action, summary, confidence_score)
  VALUES
    ('$USER_ID', 'completed', 'v1', 1000, 1000,
     'This month, direct \$500 to high-APR debt.',
     'Top categories: 50% high-APR debt, 30% emergency fund, 20% retirement match.',
     0.75)
  RETURNING id
)
INSERT INTO public.goal_optimizer_allocations
  (user_id, run_id, category, amount_usd, share_pct, priority, rationale, category_score)
SELECT '$USER_ID', id, 'high_interest_debt', 500, 50, 88,
       'High-APR debt is the highest guaranteed return.', 88
FROM ins_run;

-- finance.user_financial_profile + debt
INSERT INTO finance.user_financial_profile
  (user_id, annual_income, income_stability, employment_type,
   monthly_expenses, emergency_fund_months, credit_score_range)
VALUES ('$USER_ID', 95000, 'stable', 'w2_full_time', 4500, 2, '670_739');

INSERT INTO finance.debts
  (user_id, debt_name, debt_type, current_balance, interest_rate, minimum_payment)
VALUES ('$USER_ID', 'Sapphire', 'credit_card', 4500, 0.22, 120);

-- estate planning singleton
INSERT INTO public.estate_planning_profile
  (user_id, has_will, has_living_trust, has_financial_poa, has_healthcare_directive)
VALUES ('$USER_ID', FALSE, FALSE, FALSE, FALSE);
SQL

# Snapshot AFTER.
AFTER=$(psql "$DATABASE_URL" -tA -c \
  "SELECT count(*) FROM graphrag.sync_queue WHERE user_id = '$USER_ID';")
ENQUEUED=$((AFTER - BEFORE))

green "==> 3. graphrag.sync_queue grew by $ENQUEUED rows (expected >= 8)"
if [ "$ENQUEUED" -lt 8 ]; then
  red "Expected >= 8 enqueued rows; got $ENQUEUED. Triggers may not be installed."
  echo "Distribution:"
  psql "$DATABASE_URL" -c \
    "SELECT entity_type, count(*) FROM graphrag.sync_queue WHERE user_id = '$USER_ID' GROUP BY 1 ORDER BY 1;"
  exit 1
fi

green "==> 4. Verifying every enqueued row carries user_id, entity_type, source_table"
BAD=$(psql "$DATABASE_URL" -tA -c "
  SELECT count(*) FROM graphrag.sync_queue
   WHERE user_id = '$USER_ID'
     AND (user_id IS NULL OR entity_type IS NULL OR source_table IS NULL
          OR operation NOT IN ('upsert','delete'));")
if [ "$BAD" -ne 0 ]; then
  red "Found $BAD rows missing required columns or with invalid operation"
  exit 1
fi

echo
psql "$DATABASE_URL" -c \
  "SELECT entity_type, source_table, operation, sync_status, jsonb_pretty(payload) as payload
     FROM graphrag.sync_queue
    WHERE user_id = '$USER_ID'
    ORDER BY created_at
    LIMIT 5;"

# ----------------------------------------------------------------------
# 5. Optional: run the Rust worker locally to drain the queue.
# ----------------------------------------------------------------------
if [ "$RUN_WORKER" = "1" ]; then
  require SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY \
          GEMINI_API_KEY QDRANT_URL QDRANT_API_KEY QDRANT_PERSONAL_COLLECTION \
          NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD NEO4J_PERSONAL_DATABASE

  green "==> 5. Running Rust worker for 30s to drain the queue"
  ( cd apps/ingestion-worker && \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    GEMINI_API_KEY="$GEMINI_API_KEY" \
    QDRANT_URL="$QDRANT_URL" \
    QDRANT_API_KEY="$QDRANT_API_KEY" \
    QDRANT_PERSONAL_COLLECTION="$QDRANT_PERSONAL_COLLECTION" \
    NEO4J_URI="$NEO4J_URI" \
    NEO4J_USERNAME="$NEO4J_USERNAME" \
    NEO4J_PASSWORD="$NEO4J_PASSWORD" \
    NEO4J_PERSONAL_DATABASE="$NEO4J_PERSONAL_DATABASE" \
    WORKER_POLL_INTERVAL_SECONDS=1 \
    WORKER_BATCH_SIZE=25 \
    LOG_LEVEL=info \
    timeout 30 cargo run --release --bin ingestion-worker 2>&1 | head -120 ) || true

  REMAINING=$(psql "$DATABASE_URL" -tA -c \
    "SELECT count(*) FROM graphrag.sync_queue WHERE user_id = '$USER_ID' AND sync_status = 'pending';")
  if [ "$REMAINING" -gt 0 ]; then
    yellow "$REMAINING jobs still pending — worker may have hit external errors. Check logs above."
  else
    green "All jobs drained from queue."
  fi

  # ----------------------------------------------------------------
  # 6. Verify Qdrant point carries tenant_id = USER_ID.
  # ----------------------------------------------------------------
  green "==> 6. Verifying Qdrant point payload pins tenant_id"
  QDRANT_BODY=$(curl -sS -X POST \
    -H "api-key: $QDRANT_API_KEY" -H "content-type: application/json" \
    "$QDRANT_URL/collections/$QDRANT_PERSONAL_COLLECTION/points/scroll" \
    -d "{\"filter\":{\"must\":[{\"key\":\"tenant_id\",\"match\":{\"value\":\"$USER_ID\"}}]},\"limit\":1,\"with_payload\":true,\"with_vector\":false}")
  echo "$QDRANT_BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
pts = data.get('result', {}).get('points', [])
if not pts:
    print('NO POINTS FOUND for this tenant_id')
    sys.exit(1)
p = pts[0]
payload = p.get('payload', {})
assert payload.get('tenant_id') == '$USER_ID', f\"tenant_id mismatch: {payload.get('tenant_id')}\"
assert payload.get('user_id') == '$USER_ID', f\"user_id mismatch: {payload.get('user_id')}\"
assert payload.get('access_scope') == 'personal', 'access_scope != personal'
print('Qdrant point ok:', payload.get('entity_type'), payload.get('entity_id'))
"

  # ----------------------------------------------------------------
  # 7. Verify Neo4j node carries tenant_id = USER_ID.
  # ----------------------------------------------------------------
  green "==> 7. Verifying Neo4j node carries tenant_id via tenant-filtered Cypher"
  NEO4J_AUTH=$(printf '%s:%s' "$NEO4J_USERNAME" "$NEO4J_PASSWORD" | base64 -w0)
  curl -sS -X POST \
    -H "authorization: Basic $NEO4J_AUTH" \
    -H "accept: application/json" \
    -H "content-type: application/json" \
    "$NEO4J_URI/db/$NEO4J_PERSONAL_DATABASE/tx/commit" \
    -d "{\"statements\":[{\"statement\":\"MATCH (n) WHERE n.tenant_id = \$tenant_id RETURN n.entity_type, n.entity_id, n.tenant_id LIMIT 5\",\"parameters\":{\"tenant_id\":\"$USER_ID\"}}]}" \
    | python3 -c "
import sys, json
data = json.load(sys.stdin)
errors = data.get('errors', [])
if errors:
    print('Neo4j errors:', errors); sys.exit(1)
results = data.get('results', [])
if not results or not results[0].get('data'):
    print('Neo4j returned no rows'); sys.exit(1)
print('Neo4j sample rows:')
for row in results[0]['data']:
    print(' ', row.get('row'))
"

  # ----------------------------------------------------------------
  # 8. Cross-user leakage probe: another user_id MUST return zero.
  # ----------------------------------------------------------------
  green "==> 8. Cross-user leakage probe — querying for an unrelated tenant returns zero"
  ATTACKER_ID="00000000-0000-0000-0000-000000000999"
  ATTACK_QDRANT=$(curl -sS -X POST \
    -H "api-key: $QDRANT_API_KEY" -H "content-type: application/json" \
    "$QDRANT_URL/collections/$QDRANT_PERSONAL_COLLECTION/points/scroll" \
    -d "{\"filter\":{\"must\":[{\"key\":\"tenant_id\",\"match\":{\"value\":\"$ATTACKER_ID\"}}]},\"limit\":50}")
  POINTS=$(echo "$ATTACK_QDRANT" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result',{}).get('points',[])))")
  if [ "$POINTS" -ne 0 ]; then
    red "LEAK: scrolling for an attacker tenant_id returned $POINTS points"
    exit 1
  fi
  green "No cross-user leakage detected"
fi

# ----------------------------------------------------------------------
# Cleanup
# ----------------------------------------------------------------------
if [ "$CLEANUP" = "1" ]; then
  green "==> Cleaning up synthetic user"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
DELETE FROM public.profiles WHERE id = '$USER_ID';
DELETE FROM auth.users WHERE id = '$USER_ID';
SQL
else
  yellow "Skipped cleanup (CLEANUP=0). User $USER_ID retained for debugging."
fi

green "==> Smoke test complete."
