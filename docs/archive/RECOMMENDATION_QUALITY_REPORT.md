# Recommendation Quality Audit (Part 5) — LifeNavigator MVP Beta

**Scope:** What recommendations the system actually generates for the 10 sample personas, scored on relevance/usefulness/specificity/trustworthiness/actionability, with grounding in code.

**Headline finding:** There is **no recommendation pipeline that consumes a persona-activated user's data end-to-end and shows the result.** Three candidate surfaces exist; all are either unreachable, mis-grounded, or single-line:

1. **Gateway LLM recommendation** (`apps/api-gateway/app/routes/recommendations.py`) — _unreachable from the beta UI_ (broken call + discarded response).
2. **Next-Dollar Optimizer** (`apps/web/src/lib/optimizer/engine.ts`) — _structurally blind to persona data_; returns the identical plan for every persona.
3. **First Insight** (`apps/web/src/lib/finance/first-insight.ts`) — the _only_ persona-grounded recommendation, but it is a single sentence with no follow-through.

The "recommendation-quality-service" and "recommendation-acceptance-service" the brief points to are **pure post-hoc aggregators** (`recommendation-quality-service.ts:11-14` "No LLM is involved"; `recommendation-acceptance-service.ts`) — they score/aggregate acceptance of recommendations that something else must produce. They do not generate anything.

---

## How recommendations are (not) wired

### Surface 1 — Gateway `/api/recommendations/generate` is dead-on-arrival

`activate-persona/route.ts:143-151` fires:

```
fetch(`${apiUrl}/api/recommendations/generate`, { ..., body: JSON.stringify({ trigger: 'financial_profile_activation' }) }).catch(() => {})
```

But the gateway body model **requires `query`**:

```
class GenerateBody(QueryRequest): domain: str = ...
# common.py:9-12  query: str = Field(min_length=1, max_length=4000)
```

`{ trigger: ... }` has no `query` → FastAPI returns **422** → swallowed by `.catch(()=>{})`. Even if it succeeded, the response is **discarded** — nothing is persisted and **no dashboard component renders `recommended_actions` / `next_best_action` / `RecommendationEnvelope`** (grep shows those fields are only consumed by the unrelated optimizer types, not by any recommendation UI). The LLM recommendation path is only reachable by a raw bearer-token API call, which no non-technical beta user makes. **For all 10 personas this surface produces nothing.**

When it _is_ called directly, its content is fully LLM-generated from fused GraphRAG context (`recommendations.py:50-66`) and depends on the same Gemini/Neo4j/Qdrant stack that intermittently 502s. Compliance is a narrow regex denylist (`compliance.py:21-53`) that catches only ticker-symbol advice, medical diagnosis, guarantee phrases, and cross-user leakage — it does **not** catch generic-but-wrong advice (e.g. "invest your surplus" to someone drowning in 27% APR debt).

### Surface 2 — Next-Dollar Optimizer is blind to persona data

`engine.ts:34-86 loadInputs()` reads: `finance.user_financial_profile`, `finance.debts`, `insurance_plans`, `user_domain_risk_tolerance`, `user_decision_preferences`, `career_profiles`, `education_intake`, `goals`.

Persona activation (`persist.ts`) writes **only** `finance.financial_accounts`, `finance.transactions`, `finance.plaid_items`, and `public.user_persona_profile`. Grep confirms **nothing** in the integration path populates `user_financial_profile` or `debts`. Therefore for a persona-activated beta user every optimizer input is empty/null.

Tracing `scoreAll()` with empty inputs (`scoring.ts`):

- `emergency_fund`: months=0 → `no_emergency_fund` → risk 95 + liquidity 90 + stress 90 + prereq 70 = **raw 345** (capped to 100 weighted)
- `retirement_contribution`: 70+70+40+30 = **210**
- `taxable_investing`: 60+45+30 = **135**
- `high_interest_debt`: no debts → **0**; `retirement_match`: no match → **0**; everything else → 0 except `cash_reserve` 20.

**Result: every one of the 10 personas receives the same plan** — top up emergency fund, then retirement, then taxable investing — and `buildNextBestAction` emits _"This month, direct $X to top up your emergency fund."_ It is deterministic and compliance-clean, but it ignores that `credit_rebuilding` carries a 27.99% secured card at 92% utilization plus a payday loan (`plaid-custom-configs.ts:268-298`), and that `high_income_executive` already has a $145k money-market buffer. It will literally advise the credit-rebuilding single parent to "invest in a taxable brokerage account" once the (empty) emergency-fund line is satisfied at low surplus — **wrong and unsafe for a non-technical user acting alone.** It is also reachable only if the user navigates to `/dashboard/next-dollar-optimizer` and manually types a surplus (`next-dollar-optimizer/page.tsx:38,54`).

### Surface 3 — First Insight (the only grounded recommendation)

`first-insight.ts` reads the persisted `financial_accounts`/`transactions`/`user_persona_profile` and emits one `recommendation` string via a deterministic rule ladder (lines 108-195). This is genuinely persona-specific and the **only** recommendation a beta user reliably sees. Verified live outputs (jest `first-insight-personas.test.ts`):

- `credit_rebuilding` → _"Prioritize paying this down before adding to savings or investing."_ (risk, 92% util) — correct and safe.
- `high_income_executive` → _"Move the excess into higher-yield or invested accounts…"_ (caution, $203k cash).
- `salary_plus_bonus`, `gig_worker` → positive net-worth summary → _"Ask your advisor how to …"_ (a deflection, not an action).
- `young_professional`, `small_business_owner`, `married_family`, `bank_income` → all collapse to _"Open or fund a tax-advantaged retirement account (401(k)/IRA) this month."_

### Surface 4 — Marginal-impact ranking is goal-scoped, not persona-scoped

`/api/goals/[id]/marginal-impact-ranking` (route.ts:38-153) ranks a **fixed 11-item generic CATALOG** (reduce utilization, 401k match, finish credential, fix sleep, term life, etc.) against a goal's accessibility context. It requires an existing `goalId` and `loadGoalContext` (which, like the optimizer, depends on declared tables persona activation doesn't fill). It is not persona-derived and not on the default beta path.

---

## Per-persona scored table

Scores reflect **what a beta user actually receives** (First Insight line, since Surfaces 1/2/4 are unreachable or identical-for-all). Scale 1–5. "Optimizer-if-reached" notes what the Next-Dollar Optimizer would say given empty inputs.

| Persona               | Recommendation actually shown                                | Rel | Use | Spec | Trust | Act | Notes                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------ | --- | --- | ---- | ----- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| young_professional    | "Open/fund a 401(k)/IRA this month"                          | 4   | 3   | 3    | 4     | 3   | Reasonable but generic; ignores the $18.4k student loan + $640 card it can see. Optimizer-if-reached: emergency fund first (already has $4.8k) — slightly off.                                                                         |
| small_business_owner  | "Open/fund a 401(k)/IRA this month"                          | 2   | 2   | 2    | 3     | 2   | **Mis-fit**: persona's real needs are tax set-aside + business/personal commingling ($6.2k biz card at 18.49%); retirement nudge is the wrong lead. Optimizer ignores the SBA loan + card entirely (empty `debts`).                    |
| married_family        | "Open/fund a 401(k)/IRA this month"                          | 3   | 3   | 2    | 4     | 3   | Defensible (no retirement acct visible) but ignores $384k mortgage + $21.5k auto + 529 pace, the persona's stated focus.                                                                                                               |
| salary_plus_bonus     | "Ask your advisor how to allocate bonuses"                   | 2   | 2   | 2    | 3     | 1   | **Deflection, not a recommendation.** Has $242k assets, a $12k bonus event, low card — ripe for a concrete bonus-allocation plan that the system never gives.                                                                          |
| high_income_executive | "Move excess cash into higher-yield/invested accounts"       | 4   | 4   | 4    | 3     | 3   | Good and specific. Borderline-individualized-investment-advice; no securities named so compliance passes, but a non-technical user can't act without help. Brief notes live path may fall back to mortgage line if txns don't persist. |
| credit_rebuilding     | "Pay down the high-interest balance before saving/investing" | 5   | 5   | 5    | 5     | 4   | **Best output.** Correct, safe, specific (92%/$920 vs $1,000). The one persona where the system shines. Optimizer-if-reached would CONTRADICT it (recommend taxable investing) — dangerous if both surfaces are shown.                 |
| gig_worker            | "Ask your advisor how to manage variable income"             | 2   | 2   | 2    | 3     | 1   | Deflection. Real need: quarterly-tax set-aside + SEP-IRA room — system has the SEP-IRA + quarterly-tax txn but doesn't use them.                                                                                                       |
| earned_wage_access    | "Pay down credit cards (55% used)"                           | 3   | 3   | 4    | 4     | 3   | Decent, but the persona's defining pain — recurring EWA advances/fees (`05-26/05-22/05-17` + EWA FEE) — is never surfaced; card is the lesser problem.                                                                                 |
| bank_income           | "Open/fund a 401(k)/IRA this month"                          | 3   | 3   | 3    | 4     | 3   | OK; ignores the auto-save savings trend and deposit-stability story the persona is built around.                                                                                                                                       |
| dynamic_transactions  | (no custom config → likely empty/positive fallback)          | 2   | 2   | 2    | 3     | 2   | Uses sandbox `user_transactions_dynamic`; txns frequently don't persist (known), so insight often degrades to the generic fallback. No spending-insight recommendation is generated despite the persona's whole premise.               |

**Where output is generic, wrong, ungrounded, or unsafe:**

- **Generic-for-all (Surface 2):** identical optimizer plan for all 10 personas (empty inputs).
- **Wrong/unsafe (Surface 2):** advising taxable investing to `credit_rebuilding`/`earned_wage_access` (high-APR debt holders) because their debt is invisible to the optimizer.
- **Deflection (Surface 3):** `salary_plus_bonus`, `gig_worker` get "ask your advisor" instead of an action.
- **Mis-fit lead (Surface 3):** `small_business_owner`, `married_family` get a retirement nudge over their actual stated priorities.

---

## Dependency on chat/model path vs deterministic generation

- **Deterministic & reliable:** First Insight (Surface 3) and the optimizer scorer (Surface 2) — no model call, no 502 exposure. First Insight is the only deterministic path that is both grounded _and_ shown.
- **Model-dependent & fragile:** the gateway LLM recommendation (Surface 1, also unreachable) and the **live chat** (`/api/agent/chat` → `graphrag-query`), which is the only conversational advice surface a beta user can reach. It fails **1/3–1/2** of the time: `produce()` throws on a non-200 edge response (`chat/route.ts:56-58`) and the governed handler returns **502** (`governed-route.ts:223-226`). Budget guard returns 429 (`governed-route.ts:207`). So the richest advice channel is also the least reliable.

---

## Ranked improvements

### P0

1. **Fix the gateway recommendation call or remove it.** `activate-persona/route.ts:149` must send a real `query` (e.g. `"Give me my top financial priorities"`) and `domain` to satisfy `GenerateBody`/`QueryRequest` (`common.py:9-12`), AND the response must be persisted + rendered. As shipped it is dead code that produces zero recommendations. (Evidence: `activate-persona/route.ts:143-151`, `common.py:9-12`.)
2. **Make the optimizer persona-aware, or hide it for persona-activated users.** Either derive `user_financial_profile`/`debts`/utilization from the persisted `financial_accounts`/`transactions` + `user_persona_profile` inside `loadInputs`, or gate `/dashboard/next-dollar-optimizer` behind real declared data. Today it gives every persona the same plan and would tell high-APR-debt personas to invest. (Evidence: `engine.ts:34-86`, `scoring.ts:116-235`, `persist.ts` writes only accounts/txns/persona.)

### P1

3. **Replace First Insight's two deflection endings with concrete actions.** The positive-fallback `recommendation` (`first-insight.ts:194`) and the salary/gig branches resolve to "ask your advisor" — give a specific next step (e.g. a bonus-allocation split, a quarterly-tax set-aside %). (Evidence: `first-insight.ts:180-195`.)
4. **Harden the chat advice path against the 502.** On edge failure, return a graceful deterministic fallback recommendation (reuse First Insight) instead of a bare 502, so the user always gets _something_ actionable. (Evidence: `chat/route.ts:56-58`, `governed-route.ts:223-226`.)
5. **Differentiate the 4 personas that collapse to the same retirement line.** Add rules for business commingling/tax set-aside (`small_business_owner`), mortgage/529 pace (`married_family`), and EWA-fee leakage (`earned_wage_access`) so the recommendation matches the persona's defining problem. (Evidence: `first-insight.ts:166-178`; persona datasets in `plaid-custom-configs.ts`.)

### P2

6. **Strengthen compliance beyond ticker/medical/guarantee denylists.** Add a "don't recommend investing while high-APR consumer debt exists" semantic guard so a future LLM path can't emit the unsafe advice the optimizer currently would. (Evidence: `compliance.py:21-53`.)
7. **Surface `dynamic_transactions` spending insights.** Its entire premise (recurring-cost/subscription detection) generates no recommendation because txns don't persist and no spending-analysis recommender exists. (Evidence: `personas.ts:266-284`, no custom config; known txn-persistence gap.)

### P3

8. **Wire `recommendation_acceptance` capture from the surfaces users actually see.** The acceptance/quality aggregators (`recommendation-acceptance-service.ts`, `recommendation-quality-service.ts`) can only report quality if accept/reject is recorded; only the optimizer page records it (`next-dollar-optimizer/page.tsx:69-75`), and First Insight has no accept/reject. Without input rows the quality metrics stay empty for the beta. (Evidence: `recommendation-acceptance-service.ts:51-77`.)
