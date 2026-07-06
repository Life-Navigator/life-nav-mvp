# Employer Demo Script — LifeNavigator

**Audience:** employers / HR / benefits leaders (financial-wellness benefit) · **Length:** ~8 min
**Thesis:** a financial + career + family wellness benefit that's _cited and private_ — employees
get advisor-grade guidance; the employer gets aggregate, **PII-free** engagement metrics.

> Privacy + trust facts (A2 audit, live 2026-06-08): 0 cross-tenant edges (per-employee data is
> isolated by RLS), 100% citation coverage, Executive Dashboard exposes **counts only — no PII**.

---

## 0. Framing (45s)

"Financial stress is the #1 distraction at work. Most 'financial wellness' tools are generic
calculators. LifeNavigator gives each employee a **cited, whole-life** intelligence layer —
finance, career, education, family — and gives you **aggregate engagement metrics with zero
access to anyone's personal data.**"

## 1. The employee experience (2.5 min) — `/dashboard/readiness`

- Life Readiness command center: one score + 6 domains color-coded. "An employee opens this and
  immediately sees where they stand — protection gaps, emergency fund, career market value,
  college funding — each with a cited next step."
- Career: "Their market value cites **BLS OEWS** — real labor data, not a guess. Great for
  comp conversations and retention."
- Education: college ROI cites **College Scorecard** — directly relevant to tuition-benefit and
  upskilling programs.

## 2. Decisions employees actually face (1.5 min) — `/dashboard/life-decisions`

- "**Should I take the new job offer?**" / "**Should I go back for a degree?**" → worst/expected/
  best scenarios + cited evidence + a boundary. "This is the guidance that keeps people from
  making stressed, uninformed money moves."

## 3. The privacy guarantee (2 min) — the part that closes HR/legal

- Show the **Executive Dashboard** (`/dashboard/metrics`): Active users + **7d/30d retention**,
  reports generated, domain usage, decisions made — **all aggregate counts**.
- Point: "Notice there is **no employee name, no balance, no PII** anywhere in this view. We
  verified it in the audit — the metrics endpoint returns counts only. Employee data is isolated
  by row-level security: **0 cross-tenant edges**, measured in production."
- "You see _engagement and ROI of the benefit_. You never see an individual's finances."

## 4. Governed sharing for the employee (1 min)

- "An employee can share a redacted report with their own advisor or spouse — token-based,
  expiring, revocable, audit-logged. Their choice, their control. The employer is never in that
  loop."

## 5. The benefit ROI story (45s)

- "Engagement + retention metrics show benefit uptake. Career market-value + decision support
  correlate with retention conversations. Education ROI supports your tuition-benefit spend.
  You get a measurable, private wellness benefit."

## 6. Pilot offer (30s)

- "Cohort pilot: onboard a department, 30 days. You get the aggregate dashboard; employees get
  the full cited experience. We'll co-define the engagement KPIs up front."

**Roadmap note (be honest):** a dedicated **employer multi-tenant admin** (cohort segmentation,
SSO, per-cohort dashboards) is on the near-term roadmap; today's demo uses the platform Executive
Dashboard, which already proves the PII-free aggregate model.
