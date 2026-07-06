# EDUCATION — ROI & DECISION MODEL

The explainable scoring model behind the comparison engine. **No black-box score** — every
number decomposes into cited evidence. Design only. (Consolidates EDUCATION_ROI_MODEL +
the decision-model ask.)

## Cost & income components (per option)

- **total_cost** = tuition + fees (cited).
- **net_cost** = total_cost − scholarships − grants.
- **opportunity_cost** = forgone earnings during the program (Compensation Engine "during"
  income × duration).
- **debt_burden** = projected loan principal; **monthly_payment_estimate** (standard
  amortization at a cited rate).
- **income_lift** = Compensation Engine `after − before` (risk-adjusted).
- **time_to_breakeven** = months until cumulative lift ≥ (net_cost + opportunity_cost + interest).
- **retirement_impact / cash_flow_impact** = from the Finance graph (debt + reduced income vs
  net-worth/retirement trajectory).

## Probabilities (honest, cited)

- **probability_of_completion** (program graduation_rate, adjusted for user signal).
- **probability_of_employment_outcome** (program employment_rate / placement, cited).
  Risk-adjusted ROI weights the income lift by these probabilities.

## Scenarios (always three)

- **worst_case** (low salary outcome, longer time, lower completion).
- **most_likely** (median outcomes).
- **best_case** (upper-band outcomes).
  Reported as a range, never a single hero number. Drives the "what if salary is lower than
  expected?" answer.

## Six fit scores (0–100, each explainable)

| Score             | Driven by                                                                            |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Financial Fit** | net_cost vs budget, debt_burden vs debt capacity, cash-flow/retirement impact        |
| **Career Fit**    | program QUALIFIES_FOR target role; income_lift; skill-gap closure                    |
| **Goal Fit**      | alignment to the user's stated education/life goals                                  |
| **Risk Fit**      | completion + employment probability, accreditation/licensing risk, downside scenario |
| **Lifestyle Fit** | duration, modality (online/in-person), family/location constraints                   |
| **Time Fit**      | duration vs time horizon; time_to_breakeven                                          |
| **Confidence**    | data completeness + source freshness + band width (meta-score)                       |

Each fit score returns `{score, basis: [evidence refs], missing: [...]}` — the report shows the
decomposition, not just the number.

## Composite ranking (weighted, weights are config not code)

`overall = w_fin·Financial + w_career·Career + w_goal·Goal + w_risk·Risk + w_life·Lifestyle +
w_time·Time`, scaled by `Confidence`. Named winners (best-ROI, lowest-risk, fastest, family-fit)
are the argmax on the relevant single axis. Weights default to a balanced profile and can be
tuned to the user's stated priorities (e.g. risk-averse → up-weight Risk Fit).

## Sensitivity analysis

Perturb the top assumptions (salary outcome, aid, completion prob, discount rate) and report
which flips the ranking — surfaced as "the assumptions that matter most." This is what makes
the recommendation trustworthy rather than a point estimate.

## Explainability contract

- Every score → `:Evidence` nodes (metric_name/value/source/confidence) in the graph.
- Every assumption → `:Assumption` (text/confidence/user_confirmed/expires_at).
- The winner's edge over the runner-up → an explicit `:Tradeoff`.
- High-debt / licensure-gated paths → `:AdviceBoundary` (escalate to a professional).
  No figure without a source; missing inputs → missing-data prompt, never a guess.
