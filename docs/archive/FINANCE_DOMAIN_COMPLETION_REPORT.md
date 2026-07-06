# FINANCE DOMAIN — COMPLETION REPORT (Elite buildout, Phase 1)

**Date:** 2026-06-07 · **Status:** DESIGN/PLAN ONLY (no implementation) · Grounded against live prod.

Finance is the most mature domain and the **reference implementation** for every other domain. This report states exactly what exists, what's missing for the _elite_ bar, and the completion plan. Builds on `DOMAIN_DATA_CONTRACTS.md` + `GRAPHRAG_ENTITY_PIPELINE_SPEC.md`.

---

## 0. Honest status

Finance today: real Plaid data renders, chat answers net worth + spending from GraphRAG, pipeline healthy (1234 Qdrant points, `:TransactionSummary` 867). **But "elite" requires more than the current `/api/financial` route**: trend snapshots, budget/income/expense modeling, a recommendations store, and the matching worker entity types. So Finance is **~70% to elite**, not done.

---

## 1. Supabase tables — existing vs missing

| Table                             | Status     | Note                                                             |
| --------------------------------- | ---------- | ---------------------------------------------------------------- |
| financial_accounts                | ✅ exists  | Plaid + manual                                                   |
| transactions                      | ✅         | + transactions_inbox                                             |
| assets                            | ✅         | manual assets                                                    |
| asset_loans                       | ✅         | serves as liability-against-asset                                |
| investment_holdings               | ✅         |                                                                  |
| retirement_plans                  | ✅         |                                                                  |
| tax_profiles                      | ✅         |                                                                  |
| employer_benefits                 | ✅         |                                                                  |
| financial_goals                   | ✅         |                                                                  |
| account_connections / plaid_items | ✅         | connection state                                                 |
| **liabilities**                   | ➕ missing | dedicated liabilities (non-asset debt)                           |
| **debts**                         | ➕ missing | debt strategy needs APR/min-payment/balance rows                 |
| **cash_flow_snapshots**           | ➕ missing | monthly income/expense/net for trend                             |
| **net_worth_snapshots**           | ➕ missing | point-in-time net worth for the trend chart                      |
| **budget_categories**             | ➕ missing | budget vs actual                                                 |
| **income_sources**                | ➕ missing | salary/side/passive                                              |
| **expense_categories**            | ➕ missing | categorized spend (today categories are derived/`Uncategorized`) |
| **financial_recommendations**     | ➕ missing | persisted recs (H contract)                                      |
| **financial_events**              | ➕ missing | timeline of notable money events                                 |

All new tables follow the **migration-116 pattern** (RLS owner-read + service-write + `zz_auth_owner_insert/update` `WITH CHECK`, `security_invoker` `public.finance_*` views, `user_id`, `updated_at`, indexes on `(user_id, ...)`).

---

## 2. Worker EntityType variants — existing vs missing

Present: `financial_account, transaction_summary (alias transaction), asset, debt, investment_holding, retirement_plan, financial_goal`.
**Add (enum-before-trigger):** `liability, cash_flow_snapshot, net_worth_snapshot, budget_category, income_source, expense_category, financial_recommendation`. Each needs an `as_str` arm + `build_title`/`build_summary` case + (financial sensitivity = Medium) + unit test, then `fly deploy` BEFORE its trigger ships. (Precedent: the RiskAssessment fix.)

---

## 3. GraphRAG — labels + relationships

| entity_type              | :Label                   | relationships                                                                                      |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| financial_account        | :FinancialAccount        | (:UserProfile)-[:OWNS_ACCOUNT]->(:FinancialAccount)                                                |
| transaction_summary      | :TransactionSummary      | (:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary)-[:IN_CATEGORY]->(:ExpenseCategory)   |
| asset                    | :Asset                   | (:UserProfile)-[:HAS_ASSET]->(:Asset)                                                              |
| liability/debt           | :Liability/:Debt         | (:UserProfile)-[:HAS_LIABILITY                                                                     | :HAS_DEBT]->(:Debt)-[:AFFECTS_NET_WORTH]->(:NetWorthSnapshot)                               |
| investment_holding       | :InvestmentHolding       | (:UserProfile)-[:HAS_HOLDING]->(:InvestmentHolding)                                                |
| retirement_plan          | :RetirementAccount       | (:UserProfile)-[:CONTRIBUTES_TO]->(:RetirementAccount)                                             |
| financial_goal           | :FinancialGoal           | (:Asset                                                                                            | :IncomeSource)-[:SUPPORTS_GOAL]->(:FinancialGoal); (:Debt)-[:BLOCKS_GOAL]->(:FinancialGoal) |
| cash_flow_snapshot       | :CashFlowSnapshot        | (:IncomeSource                                                                                     | :ExpenseCategory)-[:AFFECTS_CASHFLOW]->(:CashFlowSnapshot)                                  |
| net_worth_snapshot       | :NetWorthSnapshot        | (:Asset                                                                                            | :Debt)-[:AFFECTS_NET_WORTH]->(:NetWorthSnapshot)                                            |
| budget_category          | :BudgetCategory          | (:BudgetCategory)-[:PRIORITIZES]->(:FinancialGoal)                                                 |
| income_source            | :IncomeSource            | (:UserProfile)-[:EARNS]->(:IncomeSource)                                                           |
| expense_category         | :ExpenseCategory         | (:UserProfile)-[:SPENDS_ON]->(:ExpenseCategory)                                                    |
| financial_recommendation | :FinancialRecommendation | (:FinancialRecommendation)-[:HAS_RECOMMENDATION]->(:UserProfile) (back-ref); -[:ADDRESSES]->(:Debt | :FinancialGoal)                                                                             |

Freshness: accounts/transactions daily; snapshots monthly (cron-generated); goals/recs on-change. Deletion: standard `operation='delete'` → drop point + `DETACH DELETE`.

---

## 4. Backend endpoints (Core API `domains/finance.py`)

```
GET  /v1/finance/summary          → ViewModel<FinanceSummary>  (the hero screen — all 11 tiles)
GET  /v1/finance/accounts         → accounts + balances + connection health
GET  /v1/finance/transactions     → paged, categorized, searchable
GET  /v1/finance/cash-flow        → income/expense/net series + budget vs actual
GET  /v1/finance/net-worth        → net-worth series + asset/liability breakdown
GET  /v1/finance/debt             → debts ranked by APR (avalanche) + payoff timelines
GET  /v1/finance/investments      → holdings, allocation, concentration
GET  /v1/finance/retirement       → accounts, contribution rate, projection, gap
GET  /v1/finance/recommendations  → list[Recommendation] (H contract)
POST /v1/finance/goals            → create/update financial goal
POST /v1/finance/manual-asset     → add asset (→ trigger ingest)
POST /v1/finance/manual-liability → add liability/debt
POST /v1/finance/refresh          → re-pull Plaid + regenerate snapshots
```

All return frontend-ready view-models (`DOMAIN_DATA_CONTRACTS.md` F). Frontend never assembles raw Supabase.

---

## 5. Elite UI surfaces

Hero screen (`/dashboard/finance` overview) must render in one `GET /v1/finance/summary` call — **no empty cards**:
`net worth · cash · debt · monthly income · monthly expenses · savings rate · emergency reserve (months) · top 3 opportunities · top 3 risks · next best action`.

Detail surfaces: Net Worth (trend + breakdown), Cash Flow (sankey/bars + budget vs actual), Accounts, Transactions (search/categorize), Debt Strategy (avalanche/snowball toggle + payoff curves), Investment Overview (allocation + concentration), Retirement Planning (projection + gap), Financial Goals (progress + probability via Goal Agent), Opportunity Watch, Risk Watch, Next Best Move, Scenario Lab integration (what-if → `POST /v1/decision/analyze`).

**Missing-data UX:** if Plaid not linked or snapshots empty → premium "connect/enable" prompt with the value proposition, never a blank/zeroed tile (the `$0`-reads-as-real trap).

---

## 6. Finance intelligence (recommendations)

Each rec uses the **H contract** (title, why-it-matters, evidence w/ numbers, assumptions, priority, action steps, confidence, risks, revisit date, governance verdict). Elite rec library:
pay-down-high-interest-debt (APR-ranked) · emergency-fund-gap · idle-cash-opportunity · retirement-contribution-gap · concentration-risk · insurance-gap · cash-flow-leak · savings-rate-improvement · tax-aware-planning-reminder. Generated by the **Finance Agent**, ranked by the **Recommendation Agent**, gated by **Trust/Safety** (financial-advice disclaimer where appropriate).

---

## 7. Finance chat (must answer, grounded, no hallucination)

"What is my net worth?" · "What changed this month?" (net_worth_snapshot delta) · "What debt should I pay first?" (APR ranking) · "Can I afford this purchase?" (cash-flow + emergency-reserve reasoning) · "What is my savings rate?" · "Top spending categories?" · "Am I on track for my goals?" (Goal Agent probability) · "What should I do next?" (next-best-move). Sources: Supabase authoritative facts + Personal GraphRAG + Central governance. Missing facts asked, never invented.

---

## 8. Completion checklist (Finance → elite)

- [ ] 9 new tables (migrations, 116-pattern) + indexes + snapshot cron.
- [ ] 7 new worker enum variants + tests + deploy; trigger audit `:Unknown`=0.
- [ ] `domains/finance.py` + 13 endpoints returning view-models.
- [ ] 12 UI surfaces; hero screen all-tiles-populated; premium missing-data prompts.
- [ ] Recommendation library live (H contract, gated).
- [ ] 8 chat questions answered live from real data, no hallucination.
- [ ] RLS owner-only verified; no 5xx; cost metered.

**Verdict for Finance:** structurally sound, ~70% to elite; the gap is snapshots + budgeting + recs store + their entity types + the Core API migration. No architectural blockers.
