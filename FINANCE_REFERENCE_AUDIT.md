# FINANCE REFERENCE IMPLEMENTATION — VALIDATION AUDIT

**Date:** 2026-06-08 · **Mode:** AUDIT ONLY (no migrations/schema/enum/trigger/code/deploy/commit). Findings only.
**Validating:** Render path (Plaid→Supabase→FinanceService→DomainViewModel→/api/financial→dashboard) + Intelligence path (Supabase→sync_queue→worker→Qdrant→Neo4j→GraphRAG→chat→recs). All numbers measured live against prod.

---

## SECTION 1 — Plaid → Supabase

### Plaid ingestion map

| Table                         | Rows    | Plaid linkage                                     | Receives                                |
| ----------------------------- | ------- | ------------------------------------------------- | --------------------------------------- |
| `finance.plaid_items`         | 52      | `plaid_item_id, institution_id, institution_name` | **Institutions / items**                |
| `finance.account_connections` | 0       | `plaid_item_id, plaid_access_token_encrypted`     | Connection/auth state (currently empty) |
| `finance.financial_accounts`  | **190** | `plaid_account_id, institution_name`              | **Accounts**                            |
| `finance.transactions`        | **786** | `plaid_transaction_id`                            | **Transactions**                        |
| `finance.transactions_inbox`  | 0       | —                                                 | Txn staging (empty)                     |

### Finance schema map (data presence)

`financial_accounts` (190) and `transactions` (786) are the **only populated** finance tables. **Empty:** `assets, asset_loans, investment_holdings, retirement_plans, financial_goals, tax_profiles, employer_benefits`. So: Accounts ✅, Transactions ✅; **Investments/Holdings ❌ (no data), Liabilities/Debts ❌ (no table/data), Goals ❌ (no data), Institutions ✅ (plaid_items)**.

### Normalization

Clean — Plaid IDs are confined to finance tables (`plaid_account_id`, `plaid_transaction_id`, `plaid_item_id`); no Plaid-native shapes leak past Supabase. No duplication observed.

### Missing entities for elite finance (all 9 absent)

`liabilities, debts, cash_flow_snapshots, net_worth_snapshots, budget_categories, income_sources, expense_categories, financial_recommendations, financial_events`.

---

## SECTION 2 — Core API render path

### Read-path map (FinanceService, `finance` schema, service-role, filtered `user_id`)

`financial_accounts, transactions, assets, asset_loans, investment_holdings, retirement_plans, financial_goals`. **No frontend/Plaid structures read** — system-of-record only. ✅

### DomainViewModel map (`/v1/finance/summary`)

`data.{net_worth, cash, debt, monthly_income, monthly_expenses, savings_rate, emergency_reserve_months, accounts[], top_opportunities, top_risks, next_best_action}` + `recommendations[]` (H-contract) + `missing[]` + `freshness` + `confidence`. Money is `{amount,currency}`; absent values are `null` (never `$0`).

### Dashboard dependency map

`apps/web/src/app/dashboard/finance/page.tsx` → `lib/finance/domainViewModel.ts` mapper → renders `accounts`, money tiles (em-dash + prompt when null), recommendations. **Consumes only the DomainViewModel/normalized shape.** ✅

### Remaining Plaid coupling

**None in React.** All shape coupling (`balance{amount}`→number, raw `account_type`→bucket) is isolated in the mapper.

### Fake values / unsupported fields

- No fake zeroes (verified live: empty user → `net_worth=null` + `plaid_link` prompt).
- **Unsupported by backend summary:** `transactions.{dailySpending,categorySpending,recentTransactions}`, `investments`, `cryptoAssets` — the summary omits transaction/investment detail; the dashboard renders graceful empty states for these (would go empty if the proxy is flipped before detail endpoints are added). Proxy is **not yet live** (`CORE_API_URL` unset).

---

## SECTION 3 — GraphRAG ingestion (entity support matrix)

| Entity             | Supabase rows | Trigger          | Worker enum                     | Qdrant pts | Neo4j label                 | Status           |
| ------------------ | ------------- | ---------------- | ------------------------------- | ---------- | --------------------------- | ---------------- |
| FinancialAccount   | 190           | ✅               | ✅                              | **289**    | :FinancialAccount **289**   | ✅ live          |
| TransactionSummary | 786           | ✅               | ✅ (`transaction` alias)        | **634**    | :TransactionSummary **867** | ⚠️ drift (below) |
| Asset              | 0             | ✅               | ✅                              | 0          | 0                           | ⚪ no data       |
| InvestmentHolding  | 0             | ✅               | ✅                              | 0          | 0                           | ⚪ no data       |
| RetirementAccount  | 0             | ✅               | ✅ (`retirement_plan`)          | 0          | 0                           | ⚪ no data       |
| FinancialGoal      | 0             | ✅               | ✅                              | 0          | 0                           | ⚪ no data       |
| Liability          | 0             | (asset_loans ✅) | ❌ **enum missing `liability`** | 0          | 0                           | ❌ worker gap    |
| Debt               | 0             | (asset_loans ✅) | ✅ `debt`                       | 0          | 0                           | ⚪ no data       |

**Missing worker enum support:** `liability, cash_flow_snapshot, net_worth_snapshot, budget_category, income_source, expense_category, financial_recommendation`. **Triggers:** present for every existing finance table (no trigger gap for the current set). **Counts:** 190 account + 786 transaction sync jobs, all `completed`.

---

## SECTION 4 — Qdrant

**Payload (sample financial_account) — all 6 required fields PRESENT:** `tenant_id ✓ user_id ✓ entity_type ✓ source_table ✓ title ✓ sensitivity_level ✓` (+ `access_scope, domain, entity_id, summary, created_at, updated_at`). Well-formed; user-scoped.

| entity_type                                                          | points  |
| -------------------------------------------------------------------- | ------- |
| financial_account                                                    | 289     |
| transaction_summary                                                  | **634** |
| asset / investment_holding / retirement_plan / financial_goal / debt | 0       |
| persona_profile                                                      | 77      |

- **Malformed payloads:** none observed.
- **Orphaned/drift:** total Qdrant ≈1,233 but typed finance+persona = 1,000 → **~233 points unaccounted for under `transaction_summary`** = the 233 transactions that were **relabeled in Neo4j only** (`:Unknown`→`:TransactionSummary`) without a Qdrant re-embed. Their Qdrant points still carry the pre-fix `entity_type` (e.g. `unknown`). **Qdrant↔Neo4j drift of 233.**

---

## SECTION 5 — Neo4j

| Label                                                                                  | count    |
| -------------------------------------------------------------------------------------- | -------- |
| :TransactionSummary                                                                    | 867      |
| :FinancialAccount                                                                      | 289      |
| :UserProfile                                                                           | 79       |
| :PersonaProfile                                                                        | 77       |
| :Asset / :Debt / :Liability / :InvestmentHolding / :RetirementAccount / :FinancialGoal | 0        |
| **:Unknown**                                                                           | **0** ✅ |

**Relationships:** `RELATED_TO`: **1,233** — and **nothing else**. Orphan FinancialAccount nodes: 0.

### 🔴 Critical finding — the graph is a `RELATED_TO` star, not a knowledge graph

`relationships_for()` in the worker emits exactly **one edge per node → `(:UserProfile)`**, and **finance entity types are not in the typed-label match → they fall to `_ => "RELATED_TO"`**. Consequences:

1. **No typed finance edges** (no `OWNS_ACCOUNT`, `HAS_TRANSACTION`, `HAS_HOLDING`, `SUPPORTS_GOAL`, …).
2. **No inter-entity edges at all** — every node connects only to the user; there is **no** `(:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary)`.
3. Graph "reasoning" therefore ≈ a user-filtered vector lookup with labels. The rich ontology in `SEMANTIC_ONTOLOGY_IMPLEMENTATION_PLAN.md` / `DOMAIN_DATA_CONTRACTS.md` is **not implemented** for finance (nor inter-entity for any domain).

---

## SECTION 6 — Chat grounding (per question)

Grounding = Supabase authoritative facts (FinanceService.chat_context) + Personal GraphRAG retrieval (Qdrant + the `RELATED_TO` graph). Gemini server-side, Trust/Safety gate (see §7).

| Question                            | Verdict           | Why                                                                                                                    |
| ----------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| What is my net worth?               | **Works**         | authoritative fact from `financial_accounts` (live-verified)                                                           |
| What changed this month?            | **Fails**         | needs `net_worth_snapshots`/history — absent                                                                           |
| What debt should I pay first?       | **Fails**         | no debt data (`asset_loans`=0; no debts table)                                                                         |
| What are my largest expenses?       | **Partial**       | transactions exist (786) + vector retrieval works, but categories are mostly `Uncategorized` (no `expense_categories`) |
| What is my savings rate?            | **Fails/Partial** | needs income vs expense; no `income_sources`, income-typed txns sparse                                                 |
| Am I on track for retirement?       | **Fails**         | `retirement_plans`=0; no projection                                                                                    |
| Can I afford this purchase?         | **Partial**       | net worth + cash known, but no cash-flow forecast (`cash_flow_snapshots` absent)                                       |
| What are my investment allocations? | **Fails**         | `investment_holdings`=0                                                                                                |
| Which account fees are hurting me?  | **Fails**         | no fee data / analysis                                                                                                 |

**Net:** 1 Works, 2 Partial, 6 Fail — almost entirely due to absent data (empty tables) and missing snapshot/typed-edge structure, not pipeline defects.

---

## SECTION 7 — Recommendation engine

1. **Generation:** `FinanceService.recommendations()` — deterministic, rule-based over real Supabase rows.
2. **Grounded ✅** (evidence + source_tables + source_graph_nodes), **explainable ✅** (why_it_matters + assumptions + confidence), **reproducible ✅** (deterministic), **persisted ❌** (no `financial_recommendations` table — recomputed each call).
3. **Existing generators (2):** highest-APR debt-avalanche, emergency-fund-gap.
4. **Both data-starved today:** debt rec needs `asset_loans` rows (0); emergency rec needs expense-typed transactions.

| Rec type               | Status                             |
| ---------------------- | ---------------------------------- |
| Debt optimization      | engine ✅ / **no data**            |
| Emergency fund         | engine ✅ / needs expense estimate |
| Cash flow              | ❌ missing                         |
| Retirement             | ❌ missing                         |
| Budgeting              | ❌ missing                         |
| Investment allocation  | ❌ missing                         |
| Tax optimization       | ❌ missing                         |
| Insurance optimization | ❌ missing                         |

---

## SECTION 8 — Reference-implementation scorecard

| Dimension            | Score | Rationale                                                                                                                                                                                       |
| -------------------- | :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data Model           | **6** | accounts+transactions normalized + Plaid-isolated; 9 elite tables + 5 entity datasets missing                                                                                                   |
| Render Path          | **8** | FinanceService→DomainViewModel→mapper→dashboard works; complete view-models; no fake zeroes. Gap: summary lacks txn/investment detail; proxy not live                                           |
| GraphRAG             | **4** | pipeline + payload healthy, :Unknown=0 — BUT graph is a `RELATED_TO` star (no typed/inter-entity edges) + 233 Qdrant↔Neo4j drift                                                                |
| Recommendations      | **4** | engine grounded/explainable/reproducible but not persisted, 2 generators, data-starved, 6 types missing                                                                                         |
| Chat                 | **5** | net worth works; spending partial; 6/9 questions fail (data + structure gaps)                                                                                                                   |
| Governance           | **6** | Core API Trust/Safety is an F1 **scaffold** (permissive pass); deep governance stack exists in `lib/governance` but is **not yet ported** into the Core API chat path; audit-row pattern proven |
| Explainability       | **6** | recs carry evidence/assumptions/sources/confidence; chat grounded — but graph evidence weak (`RELATED_TO`) + `ln_central` methodology corpus empty                                              |
| Production Readiness | **7** | Core API live (`/readyz` green, smoke passed, tests green); proxy not flipped; recs data-starved                                                                                                |

### Can Finance be the reference implementation for all future domains?

```
NO — not yet (close on the render path; not yet on the intelligence path).
```

The **render path is reference-quality** and the **pipeline mechanics are sound** (clean Plaid normalization, correct labels, `:Unknown`=0, complete Qdrant payload, enum-before-trigger proven). But the **intelligence path is shallow**: the graph is a `RELATED_TO` star with no semantic/traversable edges, recommendations are data-starved and not persisted, the Core API governance gate is a scaffold, and 6/9 reference chat questions fail. A reference that other domains copy must demonstrate the **full** pattern at elite quality.

### Blockers (classified)

- **GraphRAG Blocker (top):** worker emits a `RELATED_TO` star — no typed finance edges, no inter-entity edges. + 233 Qdrant↔Neo4j drift.
- **Worker Blocker:** enum missing `liability, cash_flow_snapshot, net_worth_snapshot, budget_category, income_source, expense_category, financial_recommendation` (must land **before** their triggers).
- **Schema Blocker:** 9 elite finance tables missing.
- **Recommendation Blocker:** only 2 generators; not persisted; 6 types missing.
- **Chat Blocker:** 6/9 questions fail (downstream of schema + graph-edge gaps).
- **Render Path:** _not_ a blocker; minor detail-endpoint gap before flipping `CORE_API_URL`.

### Exact remediation order + effort

1. **Worker typed relationships** — add finance arms to `relationships_for()` (HAS_ACCOUNT, etc.) AND emit inter-entity edges (account→transaction `HAS_TRANSACTION`, etc.) from payload FKs; redeploy; backfill edges. **Effort: M.** _(shared infrastructure — every domain inherits it)_
2. **Reconcile Qdrant↔Neo4j drift** — re-enqueue the 233 relabeled transactions so Qdrant `transaction_summary` matches Neo4j. **Effort: S.**
3. **Phase-1 elite schema** (9 tables, migration-116 RLS) **with worker enum variants first** (enum-before-trigger), then triggers. **Effort: L.**
4. **Recommendation breadth + persistence** — `financial_recommendations` table + cash-flow/retirement/budget/investment generators. **Effort: M.**
5. **Render detail + cutover** — proxy `/v1/finance/transactions|cash-flow|investments`, wire dashboard, then set `CORE_API_URL`. **Effort: S.**
6. **Port the real Trust/Safety governance** into the Core API chat path (replace the F1 scaffold). **Effort: M.**

### Single highest-value next task

**Fix the worker's relationship emission to produce typed, traversable edges** (finance user-edges + account→transaction inter-entity edges) instead of the `RELATED_TO` star. It converts the "labeled vector store" into an actual knowledge graph and is the foundation every future domain copies.

### What must be completed before Health & Wellness may begin

1. **Worker typed-relationship fix (#1)** — MUST, so Health does not inherit the `RELATED_TO` antipattern (shared infra).
2. **Enum-before-trigger discipline proven** — already satisfied (RiskAssessment precedent; `:Unknown`=0 audit).
3. **A complete elite template on finance** (render-detail endpoints + ≥1 fully end-to-end intelligence loop with real data, typed edges, persisted grounded recs) — SHOULD, so Health copies a finished pattern rather than a partial one.
4. **NOT required:** finance's domain-specific elite tables fully populated (debt/retirement/etc.) — those are finance content, not the shared reference pattern.

---

_Audit only. No schema/enum/trigger/code/deploy/commit changes were made. This file is written to disk but NOT committed, per the audit constraints._
