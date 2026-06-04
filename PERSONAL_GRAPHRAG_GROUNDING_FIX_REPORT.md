# PERSONAL_GRAPHRAG_GROUNDING_FIX_REPORT.md

**Date:** 2026-06-04
**Goal:** Eliminate financial hallucination — personal money facts must come from the system of record or
be refused. **Deployed** to the `graphrag-query` edge function.

---

## VERDICT: ✅ PERSONAL_CHAT_SAFE (with non-blocking follow-ups)

Across all 10 grounded personas, the chat now cites **the user's real accounts, balances, APRs, and net
worth** and **refuses** when data is absent. The "Bank of America $3,250.75" fabrication is **eliminated**.

### Generalized to ALL personal domains (commit `06373a8`)

The same fail-closed grounding now covers **everything the user has**, not just finance:
`fetchAuthoritativePersonal()` reads (in parallel, bounded) financial accounts, **transactions, employer
benefits, retirement plans, goals, career profile, job applications, education, courses, simulations,
persona profile, and prior chat sessions** directly from their systems of record, into one labeled
`AUTHORITATIVE_PERSONAL_FACTS` section (per-domain sub-blocks; empty domains render "NONE on file — do not
invent"). The `ANSWER_SYSTEM` rules apply to **any** personal fact — never invent goals, employers,
schools, simulation results, or what was said in a prior chat. Verified live (young_professional):
transactions grounded, goals + career _refused_ (no invention), persona profession grounded, finance
intact.

---

## What changed (code)

1. **Deterministic, authoritative finance read** — new `fetchAuthoritativeFinance()` reads
   `finance.financial_accounts` (service role, `eq user_id`, `is_active`) directly. Independent of async
   graph promotion, so balances are grounded the instant they exist. (`index.ts` + pure formatting in
   `grounding.ts`.)
2. **`AUTHORITATIVE_FINANCIAL_FACTS` context block** — deterministic render of each account
   (name/type/institution/balance/APR/credit-limit) + computed totals (assets, debt, net worth). This is
   declared the ONLY valid source for personal money facts.
3. **GraphRAG demoted to enrichment** — graph/vector results become `PERSONAL_CONTEXT`, no longer the sole
   source of financial truth.
4. **`MISSING_DATA` block** — explicitly lists absent categories (no accounts / transactions / income) to
   anchor refusals.
5. **Hard prompt rules** (`ANSWER_SYSTEM`) — money facts only from authoritative/personal context; if
   missing, say so; never invent banks/balances/APRs or infer from central policy or model priors.
6. **Proxy disabled** — `GRAPHRAG_PIPELINE_URL` unset so the hardened inline path can't be bypassed.

## Verification (live, 10 grounded personas, fresh cache)

| Metric                                         | Before fix        | After fix                       |
| ---------------------------------------------- | ----------------- | ------------------------------- |
| `fin_accounts` grounded (all accounts matched) | 0/10              | **10/10**                       |
| Fabricated-account responses                   | ~3–8              | **0**                           |
| Net worth correct vs authoritative             | n/a               | **10/10 ✓**                     |
| Fallback rate                                  | 50–98%            | **0% (this run)**               |
| New-user-with-no-accounts                      | invented accounts | **refuses + offers to connect** |

**Examples (real, post-fix):**

- young*professional: *"Everyday Checking $3,200.00 · Cash Rewards Card $640.00 owed · Emergency Savings
  $4,800.00 · Student Loan $25,000.00 owed"_; _"APR … 21.99% on your Cash Rewards Card"_; _"net worth
  −$17,640.00 … assets $8,000.00 minus debt $25,640.00."\_
- small*business_owner: *"You owe $6,240.00 on your Business Card, APR 18.49%."\_
- **no-account user:** _"You haven't connected any financial accounts yet. I don't have any information
  about your accounts or balances… want me to help you connect them?"_

## Tests (Task 8)

- `supabase/functions/graphrag-query/grounding.test.ts` (Deno) locks: exact balances/APR render; net worth
  computed + negative formatted; **empty → refuse, no `$` figure**; **null → unavailable**; debt
  classification; money formatting. Pure-logic mirror verified (6/6 after fixing the test's own assertion).
- Behavioral (live battery): personal context answers correctly; missing context refuses; cross-user
  isolation (each persona returned ONLY its own accounts — `fetchAuthoritativeFinance` filters by
  `user_id`, RLS-independent service read is explicitly scoped).

## Non-blocking follow-ups

1. **Query-cache staleness (P1):** `graphrag.query_cache` can serve an old balance after data changes.
   Reduce TTL or skip cache for financial questions. (Masked this fix until cache was cleared during
   verification.)
2. **Net-worth definition (P2):** debt total includes mortgages even when the home asset isn't in Plaid,
   so married_family shows −$376,940. Arithmetically correct; consider excluding mortgage-without-asset (as
   the First-Insight engine does) for a friendlier figure.
3. **422-on-refusal UX (P2):** some refusals trip the governance layer → HTTP 422. Safe, but the client
   should render a friendly refusal rather than a blocked response.
4. **Gemini concurrency (P1):** under burst the new key occasionally rate-limits; raise per-minute quota +
   monitor prepay credits.
