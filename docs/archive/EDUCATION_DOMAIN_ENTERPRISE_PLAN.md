# EDUCATION DOMAIN — ENTERPRISE PLAN

Education is a **life-outcome optimization system**, not a course tracker. Its flagship is the
**Degree & College Comparison Decision Engine** (see DEGREE_COLLEGE_COMPARISON_ENGINE_SPEC).
Built on the proven Finance/Health platform. Design only.

## Vision

Rank a user's education choices — colleges, degrees, majors, certificates, bootcamps, grad
programs, law school, MBA, online programs, trade schools — **against their own life goals**,
not against a generic national ranking. Every ranking is evidence-backed, explainable, and
linked to the user's financial/career/family plan, and exports as a premium PDF.

## Core principle

> The system does not rank schools generically. It ranks **choices against the user's life
> goals** (financial, career, family, time, risk).

## Domain goals

Optimal program selection · debt-aware decisions · ROI clarity · career-aligned credentials ·
family-constraint awareness · risk-aware timing (delay/save/employer-funded).

## User outcomes

- "Which program is best **for my goals**?" with a ranked, explained comparison.
- "Is this school worth the debt?" with cash-flow + retirement impact.
- A regenerable, versioned **PDF report** with charts, rankings, assumptions, tradeoffs, sources.

## What makes this better than college-ranking sites

| Ranking sites                  | LifeNavigator Education                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| One national list for everyone | Ranked **against this user's** goals/budget/family/time                 |
| Prestige-weighted              | ROI/risk/goal-fit weighted, prestige is one input                       |
| No personal finances           | Debt, cash-flow, retirement impact modeled from the live Finance graph  |
| No career linkage              | Program → JobTarget → CompensationRecord (Career graph)                 |
| Opaque methodology             | Every score traces to `:Evidence` with source + confidence              |
| Static                         | Regenerable report + sensitivity analysis + assumptions you can confirm |

## Enterprise-grade standard

Same as Finance/Health: 116-RLS, enum-before-trigger, ontology registry (no RELATED_TO for
mapped types), recommendation evidence graph, 15 GRAPH_QUALITY_GATES, chat grounding, no fake
data, missing-data prompts.

## Data required

User goals/constraints (career, finance, family, time, geography, risk) · program/school facts
(tuition, fees, duration, accreditation, licensure) · outcomes (graduation rate, employment
rate, salary outcomes) · aid (scholarships, grants) · compensation bands (from the Job-Market
layer). Public sources: **IPEDS / College Scorecard** for outcomes; BLS/O\*NET for comp.

## What must NEVER be guessed (requires source citation)

- Tuition / fees / duration / accreditation / licensure → from `schools`/`education_programs`
  rows with `source` (institution or IPEDS), never invented.
- Graduation/employment/salary outcomes → from `program_outcomes` with `source` (College
  Scorecard/IPEDS) + `as_of`.
- Bar/licensing pass rates → from `licensing_requirements` with source.
- Compensation lift → Compensation Engine (cited band).

## What requires user confirmation

- Personal constraints (budget ceiling, time horizon, willingness to relocate, family plans).
- Assumptions with `user_confirmed=false` (e.g. "income stays flat during school") are surfaced
  for confirmation before they drive a high-stakes recommendation.

## Connects directly to

**Career** (Program QUALIFIES_FOR JobTarget; Certification CLOSES_SKILL_GAP Skill),
**Finance** (Program IMPACTS CashFlowSnapshot/NetWorthSnapshot; FUNDED_BY FinancialGoal),
**Family** (family constraints gate recommendations; college planning).
