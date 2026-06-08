# COMPENSATION INTELLIGENCE ENGINE

The shared estimator that grounds **both** Career moves and Education ROI in real
compensation numbers — never fantasy salaries. Design only.

## Principle

Every compensation figure is an **estimate with a cited source band and a confidence**, never
a point guess and never a social-media number. Output is always `{value, band:[low,high],
source, confidence, as_of}`.

## Inputs

current experience (years, management years) · current education · certifications · skills ·
geography · employer type · industry · role · military experience · licenses · security
clearances · market demand · job-market conditions.

## Method (explainable, not a black box)

```
base        = CompensationBand(role, industry, geography).median        # from source feed
+ experience_adjustment(years, management_years)                        # documented curve
+ credential_premium(degree, certifications, licenses, clearance)       # from credential→lift table
× market_demand_factor(role, geography)                                 # MarketDemand/HiringTrend
→ estimate {value, band, source, confidence}
```

Each term is a cited, inspectable adjustment. `confidence` degrades when inputs are sparse or
the source band is wide / stale.

## Outputs

- **Current market value** (for the user's present profile).
- **Promotion value** (next level in the same track).
- **Certification value** / **degree value** (the lift attributable to a credential).
- **Location-adjusted value** (geography normalization).
- **Compensation projections** over a horizon.
- **Confidence scores** on every figure.

## Phased lift (drives Education ROI)

The engine evaluates compensation at three points so Education ROI can compute the delta:

- **Before** the program (current market value).
- **During** the program (reduced/部分 income — opportunity cost input).
- **After** the program (post-credential market value).
  The income lift = `after − before` (risk-adjusted by completion + employment probabilities).

## Hard rules

- **No fantasy salaries.** Every number ties to a `CompensationBand` source row.
- **No social-media assumptions.** Sources are labor-market feeds (e.g. BLS/O\*NET/licensed
  comp data), not anecdotes.
- **All recommendations require evidence** — a comp figure used in a recommendation becomes an
  `:Evidence` node with `metric_name=market_value`, `metric_value`, `source_table`, `confidence`.
- **Downside honesty** — always emit a band; surface the low end in risk/sensitivity analysis.

## Where it lives

A Core API service (`CompensationService`) consumed by `CareerService` and `EducationService`.
Reads `compensation_bands`, `market_demand`, `hiring_trends` (Job-Market Intelligence) + the
user's profile. Pure, deterministic, cited — same discipline as the Finance recommendation
engine.
