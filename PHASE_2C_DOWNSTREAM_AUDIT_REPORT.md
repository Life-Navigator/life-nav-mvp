# PHASE 2C — DOWNSTREAM FINANCE AUDIT + STALE MIRROR CLEANUP — 2026-06-10

Branch `fix/platform-trust-stabilization`. Core API classified resolver live (v66). Validated
against the prod-wired preview. Founder journey **13/13**.

## Reports Audit Result

`report_engine.py` builds finance sections around **`net_worth`** (current/prior/delta/trend, sourced
from `finance.net_worth_snapshots`) plus a separate **Retirement Impact** section. It does **not**
emit an "Investments" total that folds in retirement/real-estate/other. **No mislabel found.**
Caveat: report net worth reads `net_worth_snapshots` (a snapshot table), not the live resolver
summary — if snapshots aren't populated the trend is empty, but that's a data-population gap, not a
classification/mislabel bug.

## Estate / Family Office Audit Result

- **Estate / Legacy page:** consumes the classified resolver via `FinancialResolverPanel`
  (`investment_balance`, `retirement_balance`, `cash_balance`) — now correctly classified
  (investment = investment-only). No mislabel. (Demo mode was already removed in Phase 1.)
- **Family Office (`/v1/family/office`):** handles estate/trust/beneficiary/survivor/legacy
  readiness; it does **not** present asset-class totals, so there is nothing to mislabel. **PASS.**

## Decision Brain Finance Result

No direct consumption of classified finance fields in the Decision Brain frontend; it calls the
decision endpoints rather than rendering asset-class breakdowns. **No asset-class mislabel surfaced.**
(The Core API decision-factor internals were not deep-audited this sprint — flagged.)

## Scenario Finance Result

`life-decisions/scenarios` renders outcome **`net_worth`** with an honest **`net_worth_known`** flag
(amber when unknown). It does not treat retirement as taxable investment or show asset-class totals.
**PASS** (uses net worth honestly; respects unknown state).

## Dashboard Pixel Validation Result

**DEFERRED — no headless browser available in this environment.** Proven at the data + endpoint layer
instead: the Dashboard finance card, Financial Overview, Investments, Retirement, Assets, and
`NetWorthSummary` all consume `/api/finance/canonical-summary`, `/api/investments/analytics`, and
`/api/assets`, which were validated live (correct classified values, reconciled). Visual/screenshot
confirmation of rendering remains the one open item.

## Stale Mirror Cleanup Plan / Result

**Investigation (before deleting):**

- `finance.assets`: 5 rows, **all 5 mirrors** (`metadata.source=connected_account`, `asset_type=investment`); **0 genuine assets**.
- `finance.retirement_plans`: 5 rows, **all 5 mirrors**.
- All owners were `@lifenav.test` **test users**.
- **Risk: LOW** — the deployed resolver and `/api/assets` already exclude mirrors on read, so deletion
  changes no live value; owners are test users; no genuine user-entered assets exist.

**Result:** deleted 5 mirror `assets` + 5 mirror `retirement_plans` → both tables now **0 rows**
(verified). Mirror filter (`metadata->>source = 'connected_account'`) left any genuine user-entered
assets untouched (there were none).

**Broader pollution finding:** 70 `@lifenav.test` test users existed in prod (auth-delete in the
probes did not cascade finance rows). Cleaned **this session's 20** test users (`founder-/p2a-/p2b-/
iso-/invchk-`) + their finance data. **50 pre-existing fixtures remain** (`beta-journey`×20,
`beta20sim`×20, `b20-personas`×10 from prior sessions) — left in place (not mine to delete blindly;
recommend a dedicated cleanup). Also: `founder-journey.mjs` self-cleanup is unreliable when
`generate_link` doesn't return a uid — worth hardening.

## Founder Journey Result

**13/13 PASS** for A/B/C against the **deployed classified resolver (v66)**:

- C `net_worth = 290080`, investments `status=limited_data total=920000`
- A/B `no_investment_accounts total=0`
  Targeted finance assertions all hold: investment_accounts 920K, retirement_accounts 410K,
  net_worth 290080, possible_home_equity_gap true, assets endpoint returns only non-account assets,
  investments endpoint total = investment accounts (not total assets).

## Remaining Finance Trust Risks

1. **Pixel/screenshot** validation of finance pages still pending (no headless browser here).
2. **Report net worth** sourced from `net_worth_snapshots` (may be unpopulated) rather than the live
   resolver summary — population gap, not a mislabel.
3. **Core API decision-factor internals** not deep-audited for classified-field usage.
4. **50 pre-existing `@lifenav.test` fixtures** + their finance data remain in prod (recommend cleanup).
5. **`founder-journey.mjs` self-cleanup** unreliable (uid extraction) — leaves test users on failure.
6. **Branch not merged**; production web still serves old code (Core API is updated for all).

## Definition of Done — status

Downstream finance surfaces audited; **no surface mislabels investment / retirement / real estate /
other assets / liabilities / net worth** (the classification fix in the canonical summary propagates
correctly; downstream mostly consumes `net_worth`). Stale mirror rows identified and safely removed
(0 remain). Founder journey **13/13**. Open: pixel validation + pre-existing fixture cleanup + report
snapshot population.
