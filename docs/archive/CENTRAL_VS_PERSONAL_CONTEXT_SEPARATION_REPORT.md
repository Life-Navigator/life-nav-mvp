# CENTRAL_VS_PERSONAL_CONTEXT_SEPARATION_REPORT.md

**Date:** 2026-06-04
**Rule enforced:** _Central GraphRAG guides HOW to answer. Personal/Supabase determines WHAT is true.
If personal facts are unavailable, refuse — never invent from central policy or model priors._

---

## The four labeled context sections (now in the prompt)

The edge function assembles context as four explicitly-labeled blocks (`index.ts`), in this order:

1. **`CENTRAL_CONTEXT`** — shared advice policy/methodology retrieved from the central Qdrant collection
   (`ln_central`, **no tenant filter**). Governs HOW to answer (framing, compliant language, advice
   principles). Contains **no** personal data. Falls back to "apply standard prudent, compliant
   principles" when empty.
2. **`AUTHORITATIVE_FINANCIAL_FACTS`** — the user's actual accounts read directly from
   `finance.financial_accounts` (system of record). The ONLY valid source for balances/APRs/accounts/net
   worth.
3. **`PERSONAL_CONTEXT`** — enrichment facts from the user's personal graph/vector (goals, profile, risk)
   — tenant-isolated; NOT the primary source for money figures.
4. **`MISSING_DATA`** — categories explicitly unavailable, to anchor refusals.

## The hard rules (in `ANSWER_SYSTEM`)

1. Central tells you HOW; authoritative/personal tell you WHAT. Never mix them up.
2. Any personal money fact (balance, account, institution, APR, debt, income, net worth, transactions)
   MUST come verbatim from `AUTHORITATIVE_FINANCIAL_FACTS` (or `PERSONAL_CONTEXT` if explicitly present).
3. If a requested personal fact isn't present (or is under `MISSING_DATA`), say you don't have it and offer
   to connect it. Do not estimate or infer.
4. Never fabricate personal financial data — no sample numbers, well-known bank names, or central/training
   figures presented as the user's.
5. **Never derive a personal financial fact from `CENTRAL_CONTEXT`** — central is policy/education only.
6. Use `CENTRAL_CONTEXT` for methodology + compliant, non-guaranteeing language.

## Evidence the separation holds (Task 8 scenarios)

| Scenario                                                   | Result                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Central-only context cannot answer a personal balance      | ✅ Central carries no balances; rule 2/5 force "I don't have that." Verified live: no-account user **refused** the balance question.                                                                                       |
| Personal context answers the balance correctly             | ✅ 10/10 personas cite exact balances/APR from `AUTHORITATIVE_FINANCIAL_FACTS`.                                                                                                                                            |
| Missing personal context refuses                           | ✅ Empty/null → refusal text with **no `$` figure** (unit test + live no-account user).                                                                                                                                    |
| Cross-user personal context inaccessible                   | ✅ `fetchAuthoritativeFinance` filters `user_id`; Qdrant `tenant_id`+`user_id`+`access_scope`; Neo4j `$tenant_id` guard; RLS on finance. Each persona returned ONLY its own accounts.                                      |
| Persona switch clears old personal graph context           | ✅ by design: activation deletes prior `financial_accounts` → DELETE trigger enqueues graph/vector purge; and the **authoritative read reflects the current rows immediately** (no stale balances from the prior persona). |
| Central graph rules still apply to recommendation language | ✅ `CENTRAL_CONTEXT` + rule 6 enforce compliant, non-guaranteeing language; the governance/character layer (422s observed) is an independent backstop.                                                                     |

## Note

Central retrieval (`ln_central`) is wired and queried, but the central collection may be sparsely seeded —
when empty, the prompt applies standard prudent principles. Seeding the central ontology (regulatory
guidance, methodology, compliance language) is a content task that further strengthens the HOW layer; the
_separation and refusal guarantees do not depend on it_.
