# First Insight Improvement Report — LifeNavigator Beta

**Scope:** the deterministic First Insight engine at `apps/web/src/lib/finance/first-insight.ts`, rendered server-side at the top of the dashboard via `apps/web/src/components/dashboard/FirstInsightCard.tsx`. Reviewed against every persona's _actual_ synthetic dataset in `apps/web/src/lib/integrations/plaid/plaid-custom-configs.ts`, the account-type mapping in `apps/web/src/lib/integrations/plaid/persist.ts`, and persona metadata in `apps/web/src/lib/integrations/plaid/personas.ts`.

**Method:** I reproduced the engine's exact metric math (`cash`, `assets`, `utilization`, `monthlyExpenses`, `runwayMonths`, `netWorth`, `hasRetirement`) against each persona config and ran it through the same rule ladder (`first-insight.ts:108-195`). My computed firing rule for every persona matches the documented known outputs exactly, so the rewrites below are grounded in what the engine _actually_ emits today, not a guess.

## Verified per-persona firing today

| Persona               | cash     | assets     | util | runway | hasRet | Rule fired       | Severity |
| --------------------- | -------- | ---------- | ---- | ------ | ------ | ---------------- | -------- |
| young_professional    | $8,000   | $8,000     | 13%  | 4.3mo  | no     | **5 retirement** | neutral  |
| small_business_owner  | $33,600  | $33,600    | 25%  | 3.6mo  | no     | **5 retirement** | caution  |
| married_family        | $31,400  | $31,400    | 16%  | 10.3mo | no     | **5 retirement** | caution  |
| salary_plus_bonus     | $14,200  | $242,200   | 9%   | 6.1mo  | yes    | 6 fallback       | positive |
| high_income_executive | $203,200 | $1,533,200 | 4%   | 35.2mo | yes    | 4 idle cash      | caution  |
| credit_rebuilding     | $420     | $420       | 92%  | n/a    | no     | 1 utilization    | risk     |
| gig_worker            | $6,100   | $44,100    | 11%  | 3.8mo  | yes    | 6 fallback       | positive |
| earned_wage_access    | $180     | $180       | 55%  | n/a    | no     | 1 utilization    | risk     |
| bank_income           | $16,700  | $16,700    | 13%  | 9.3mo  | no     | **5 retirement** | caution  |

Four personas — **young_professional, small_business_owner, married_family, bank_income** — land on rule 5 and render the headline `"No retirement account is showing up yet."` (`first-insight.ts:172`). That is the operator's verbatim BAD example: a flat observation with no consequence, no number, no trade-off.

---

## P0-1 — Four personas show the banned BAD pattern; rule 5 never quantifies the cost

**Evidence:** `first-insight.ts:166-178`. The headline is literally `No retirement account is showing up yet.` with `metric: '0'`. The detail ("decades of compounding work in your favor") gestures at a consequence but attaches **no dollar figure**, and the `metric` is `'0'` which is meaningless to a human.

**Why it's weak:** A non-technical beta user reads "No retirement account is showing up yet" and thinks _"the app didn't find my 401(k)"_ — it reads like a data-sync failure, not advice. There is nothing to care about _today_.

**Rewrite — make it future dollars (opportunity cost), which is GREAT-bar (quantified + comparative).** Use a simple, defensible compounding estimate the engine can compute deterministically from data already present: an assumed annual contribution capacity derived from cash, a years-to-65 horizon from `life_stage`, and a 7% nominal return.

Math the engine can do with current data:

- `yearsToRetire` from `life_stage`: early_career→37, mid_career/self_employed→27, business_owner/family/general→25, peak_earning→12, recovery/hourly_worker→25.
- `annualContrib = clamp(round(cash * 0.15 to nearest $500), $1,000, $7,000)` — a believable, conservative "what you could shelter" number anchored to their actual cash, capped at the IRA limit.
- `futureValue = annualContrib * (((1.07^years) - 1) / 0.07)` (future value of an annuity at 7%).

Concrete rewrites (exact copy the engine should emit):

**young_professional** (early_career, $8,000 cash, 37 yrs): annualContrib ≈ $1,000; FV ≈ $185,600.

- headline: `Putting even $1,000/yr into a retirement account now could be worth about $186,000 by the time you retire.`
- detail: `You have 37 years of compounding ahead — the single biggest advantage you'll ever have, and nothing is going into a tax-advantaged account yet.`
- recommendation: `Open a Roth IRA and set up a $85/month auto-contribution this week.`
- severity: `caution` (raise from neutral — this is the highest-leverage move for them).
- metric: `$186,000` (rendered, see P1-2).

**small_business_owner** (business_owner, $33,600 cash, 25 yrs): annualContrib ≈ $5,000 (cap-adjacent); FV ≈ $316,000.

- headline: `As an owner you can shelter far more than an employee — $5,000/yr could become roughly $316,000 by retirement.`
- detail: `You're reinvesting in the business, but no SEP-IRA or Solo 401(k) is showing up — that's tax-deductible retirement room you're leaving on the table every year.`
- recommendation: `Open a SEP-IRA before your next quarterly tax payment to deduct this year's contribution.`
- severity: `caution`.

**married_family** (family, $31,400 cash incl. $22k "529/Family Savings", 25 yrs): annualContrib ≈ $4,500; FV ≈ $285,000.

- headline: `You're saving for the kids, but nothing is going to your own retirement — about $4,500/yr could grow to roughly $285,000.`
- detail: `Your $22,000 in family/college savings is real progress; a parallel retirement contribution is the gap most dual-income households miss.`
- recommendation: `Each of you confirm your employer 401(k) match is fully captured — that's free money before anything else.`
- severity: `caution`.

**bank_income** (general, $16,700 cash, 25 yrs): annualContrib ≈ $2,500; FV ≈ $158,000.

- headline: `Your auto-save habit is good — pointing even $2,500/yr at retirement could be worth about $158,000 by 65.`
- detail: `You already auto-save to a regular savings account; the same money in a tax-advantaged account compounds tax-free.`
- recommendation: `Redirect part of your auto-save into a Roth IRA to put it on a tax-advantaged track.`
- severity: `caution`.

**Fix (rule 5 rewrite), `first-insight.ts:166-178`:** replace the static headline with the FV computation above. Pseudocode:

```ts
if (!hasRetirement && persona?.life_stage && assets >= 2000) {
  const years = YEARS_TO_RETIRE[persona.life_stage] ?? 25;
  const annualContrib = Math.min(7000, Math.max(1000, Math.round((cash * 0.15) / 500) * 500));
  const fv = annualContrib * ((Math.pow(1.07, years) - 1) / 0.07);
  return {
    ...base,
    severity: 'caution',
    metric: usd(fv),
    headline: `Putting even ${usd(annualContrib)}/yr into retirement now could be worth about ${usd(fv)} by the time you retire.`,
    detail: `You have ~${years} years of compounding ahead and nothing is going into a tax-advantaged account yet.`,
    recommendation: `Open or fund a 401(k)/IRA and automate a monthly contribution this week.`,
  };
}
```

Persona-specific copy (SEP-IRA for owners, employer-match for family) can be keyed off `persona_id` / `income_type`.

**Severity: P0** — this is the single most-cited operator complaint and affects 4 of 9 personas a beta user will see first.

---

## P0-2 — APR exists end-to-end but is silently dropped, blocking the flagship "debt vs invest" insight

**Evidence:**

- `finance.financial_accounts` has an `interest_rate NUMERIC` column — `supabase/migrations/031_finance_domain.sql:19` ("APR as decimal").
- Every persona's credit card carries a real APR via `creditLiability(apr, minPay, overdue)` in `plaid-custom-configs.ts:43-51` (e.g. young_professional 21.99%, credit_rebuilding 27.99%, earned_wage_access 26.99%).
- A Plaid `getLiabilities()` client already exists — `apps/web/src/lib/integrations/plaid/client.ts:75-78`.
- **But** `persistAccounts` (`persist.ts:136-149`) builds its row with no `interest_rate` field, and `activate-persona/route.ts:90-91` never calls `getLiabilities`. The engine's `AccountRow` type (`first-insight.ts:29-34`) has no APR field at all.

**Consequence:** The engine cannot compare card APR to savings yield, so the utilization headline (`first-insight.ts:116-118`) hand-waves with "Card interest almost always beats what savings earn" instead of the true rate. The operator's stated GREAT example — _"You could improve long-term wealth more by paying down this debt than increasing savings"_ — is **impossible to generate truthfully** because the comparison input is thrown away. This also undermines `credit_rebuilding` (27.99% APR, overdue) and `earned_wage_access` (26.99%), the two riskiest personas, where the exact rate is the whole point.

**Fix (two parts):**

1. **Persist APR.** In `activate-persona/route.ts`, after `getAccounts`, call `getLiabilities(accessToken)` and merge `credit[].aprs[].apr_percentage` (and `minimum_payment_amount`) by `account_id`; in `persist.ts:136-149` add `interest_rate: apr ?? null`. Then add `interest_rate` to the engine's `select` (`first-insight.ts:51`) and `AccountRow`.
2. **APR-vs-yield rule (new, above current rule 1).** With a savings yield assumption `SAVINGS_APY = 0.045` (4.5% HYSA, conservative for 2026):

```ts
// Rule 0: high-APR revolving debt vs. what cash earns — the clearest trade-off.
const worstCard = cards
  .filter((c) => bal(c) > 100)
  .sort((a, b) => (b.interest_rate ?? 0) - (a.interest_rate ?? 0))[0];
if (worstCard && (worstCard.interest_rate ?? 0) >= 0.1) {
  const apr = worstCard.interest_rate!; // e.g. 0.2799
  const b = bal(worstCard);
  const annualInterest = b * apr; // cost of carrying
  const spread = apr - SAVINGS_APY; // guaranteed "return" from payoff
  return {
    severity: 'risk',
    metric: `${(apr * 100).toFixed(1)}%`,
    headline: `Paying off this ${(apr * 100).toFixed(0)}% card beats any investment you could make right now.`,
    detail: `That ${usd(b)} balance costs ~${usd(annualInterest)}/yr in interest. Cash earns ~${(SAVINGS_APY * 100).toFixed(1)}%, so every dollar to the card is a guaranteed ${(spread * 100).toFixed(0)}% return.`,
    recommendation: `Send any spare cash to this card before adding to savings or investing.`,
  };
}
```

This converts the credit_rebuilding / earned_wage_access insights from "your cards are X% used" (utilization framing) to the GREAT decision framing the operator wants, and makes the utilization rule (rule 1) the fallback when APR is missing.

Applied to verified personas: credit_rebuilding → `Paying off this 28% card beats any investment you could make right now.` ($920 × 0.2799 ≈ $258/yr; guaranteed 23% spread). earned_wage_access → 27% card, $410 balance. Both far stronger than the current "92% used / 55% used."

**Severity: P0** — without persisting APR the operator's headline example cannot be honestly produced.

---

## P1-1 — Runway rules run on a corrupted `monthlyExpenses`, and rarely fire live

**Evidence:** `first-insight.ts:100-103`. `monthlyExpenses` sums `transactions` where `transaction_type === 'expense'`. Per `persist.ts:179`, `transaction_type = amount >= 0 ? 'expense' : 'income'`, and in the configs **payroll is encoded as a negative amount** (e.g. `tx(D('05-31'), -2150, 'EMPLOYER PAYROLL')` → income), while only the positive entries (rent, groceries, a loan payment) become "expenses." So `monthlyExpenses` is a small, non-representative slice of real spending:

- `married_family`: monthlyExpenses = $3,050 (mortgage $2,350 + childcare $240 + grocery $318 + $142) → runway **10.3 months**. That's wrong; the household clearly spends far more than $3,050/mo. The inflated runway is why married_family _doesn't_ trip rule 4 idle-cash and why no runway-based warning ever fires for a family carrying real obligations.
- `small_business_owner`: monthlyExpenses = $9,350 mixes business AP, SaaS, and payroll-run together → runway 3.6mo is coincidental, not meaningful.

Compounding this is the **KNOWN sandbox bug**: override transactions frequently persist as `transactions_synced: 0` (`activate-persona/route.ts:97-104`), so `runwayMonths` is `null` live and rules 2 & 4 silently don't fire — the engine falls through to retirement/fallback. So runway is both _miscomputed_ (test path) and _absent_ (live path).

**Fix:** Don't derive runway from a transaction subset. Estimate monthly spend from a stable signal: detected recurring outflows (rent/mortgage/childcare) plus a category-based floor, OR fall back to an income-based estimate (sum of `income` txns × an 0.85 spend ratio) when expense txns are sparse. At minimum, gate rules 2 and 4 on `expenses.length >= 3` so a 1-2-txn fluke can't drive a runway claim. Document `SAVINGS_APY` and the spend model as assumptions.

**Severity: P1** — affects correctness of two rules; partially masked today because the bad runway happens to route the 4 affected personas into the (also-bad) retirement rule.

---

## P1-2 — The `metric` (the number that "makes it real") is never rendered

**Evidence:** `FirstInsightCard.tsx:64-78` renders `headline`, `detail`, and `recommendation` only. `insight.metric` (`first-insight.ts:24`, computed for every rule) is never displayed. The comment at `first-insight.ts:24` calls it "the number that makes it real" — but the card discards it.

**Why it matters:** For the rewritten quantified insights (future-value, annual interest cost), surfacing the headline number as a bold chip ("$186,000", "28% APR", "$258/yr") is exactly the <10-second hook. Today the engine computes it and the UI throws it away.

**Fix:** In `FirstInsightCard.tsx`, when `insight.metric` is non-empty, render it as a prominent figure beside the "Today's brief" chip or inline-emphasized in the headline. Cheap, high-impact.

**Severity: P1.**

---

## P2-1 — Fallback (rule 6) is a flat summary, not advice

**Evidence:** `first-insight.ts:186-195`. salary_plus_bonus and gig_worker both land here: `"$242,200 in savings & investments across 3 accounts."` / `"$44,100 in savings & investments across 2 accounts."` with recommendation `"Ask your advisor how to ..."`. This is the BAD pattern (observation, no consequence) for two _healthy_ personas who have the most room for a sophisticated insight.

**Rewrite ideas (data already present):**

- salary_plus_bonus: cash $14,200 vs invested $228,000, and a recurring $12,000 bonus txn exists in the config. → `Your $12,000 bonus is best put to work the day it lands — splitting it across your 401(k) and brokerage could add roughly $X over 10 years vs leaving it in checking.`
- gig_worker: has a SEP-IRA ($38,000) and 1099 income but no tax-set-aside account. → `On 1099 income you can still add to your SEP-IRA this year — about $X of deductible room based on your deposits.`

**Severity: P2** — these read as positive so they're not alarming, but they waste the highest-value personas.

---

## P2-2 — `high_income_executive` idle-cash insight understates the real lever

**Evidence:** rule 4 fires (`first-insight.ts:150-160`): `"$203,200 is sitting in cash — likely earning less than inflation."` This is already at the GOOD bar (quantified consequence). It can reach GREAT by quantifying the drag in dollars: $203,200 idle vs a 4.5% HYSA ≈ **$9,000/yr** foregone, or vs their own 7% portfolio ≈ $14,000/yr. Add: `That cash is costing you roughly $9,000/yr in foregone yield.` Small change, large credibility gain for the persona most likely to notice imprecision.

**Severity: P2.**

---

## P3 — Minor

- `metric: '0'` in rule 5 (`first-insight.ts:171`) is dead/meaningless once the FV rewrite lands; remove or replace with the FV string.
- The `dynamic_transactions` persona has no custom config (`plaid-custom-configs.ts:389-391`) so it isn't in the verified table; confirm it doesn't fall to the empty-state branch (`first-insight.ts:68-77`) for beta users, or exclude it from the beta picker.

## Recommended ladder ordering after fixes

1. **Rule 0 (new):** high-APR debt vs cash yield (needs P0-2 APR persistence).
2. Rule 1: utilization (fallback when APR missing).
3. Rule 2: thin runway (after P1-1 fix + `expenses.length>=3` gate).
4. Rule 3: consumer debt > assets.
5. Rule 4: idle cash (add dollar-drag, P2-2).
6. **Rule 5 (rewritten):** retirement opportunity cost in future dollars (P0-1).
7. Rule 6 (rewritten): goal-aware advice, not a balance readout (P2-1).
