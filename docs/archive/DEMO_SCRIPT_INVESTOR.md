# Investor Demo Script — LifeNavigator

**Audience:** investors / fundraising · **Length:** ~8 min · **Thesis:** an advisor-grade,
evidence-graphed life-intelligence platform — every number cited, every report reproducible,
every recommendation explainable. Not a chatbot.

> All claims below are validated live (A2 audit, 2026-06-08): 0 Unknown nodes, 0 cross-tenant
> edges, 0 sync failures, 100% citation coverage, 100% report reproducibility, 100% decision
> explainability.

---

## 0. One-liner (15s)

"LifeNavigator turns a person's whole financial + career + education + family picture into an
advisor-grade, _cited_ intelligence layer — and lets them share a governed report with their
advisor, CPA, or parents. Think 'a fiduciary analyst that shows its work,' not a chatbot."

## 1. The command center (90s) — `/dashboard/readiness`

- Open the **Life Readiness** screen. One score (the Life Readiness Index) + 6 domains, each
  GREEN/YELLOW/ORANGE/RED with the #1 gap and next step.
- Point: "This user is **YELLOW (67)** — Family is **RED** because of a **$1.0M life-insurance
  protection gap** we computed from _their own income basis_, Health is GREEN. No fake green —
  empty domains read 'get started'."
- **Why it matters:** instant whole-life triage. This is the daily-active surface.

## 2. Ask a real decision (90s) — `/dashboard/life-decisions`

- Type "**Should I get an MBA or invest the money?**"
- Show worst/expected/best scenarios + **cited evidence** (BLS OEWS wage bands, College
  Scorecard earnings) + tradeoffs + confidence + a governance boundary.
- Point: "Every line traces to a source. The decision is **persisted as a graph** — explainable,
  auditable, not a one-off LLM answer."

## 3. The cited, reproducible report (90s)

- Generate the **Education PDF** (one click → branded, multi-page: exec summary, program
  comparison, ROI with charts, family impact, **evidence appendix + citations**).
- Point: "Regenerate it — **same inputs, same content hash.** Auditable. An advisor can stake
  their name on it."

## 4. The trust multiplier — governed sharing (60s)

- Create a **share link for a CPA**. Open it with no login → the report renders **redacted to
  the CPA's scope** (health + family hidden). Revoke it → link returns **410 Gone**. Show the
  **audit log**.
- Point: "Consent ledger + redaction + expiration + audit. This is how a fintech earns
  institutional trust — and our distribution wedge (advisors bring their books)."

## 5. Proof it's real (60s) — `/dashboard/metrics` + the audit

- Show the **Executive Dashboard** (users, retention, reports, shares, domain usage).
- Read the **A2 invariants**: "0 Unknown nodes, 0 cross-tenant edges, **100% citation coverage**,
  **100% reproducibility**. We measured this in production this morning."

## 6. The moat (45s)

- Tri-store **evidence graph** (Postgres + Neo4j + Qdrant), uniform domain framework (we shipped
  5 domains on one rail), strict governance boundaries, and a reference-data provenance registry
  (BLS/O*NET/ACS/Scorecard/IPEDS). "Competitors give answers. We give *cited, sharable,
  reproducible\* answers — the part that's hard to copy."

## 7. The ask (30s)

- Raise to: (a) automate Tier-1 ingestion at scale, (b) advisor pilot → revenue, (c) employer/
  cohort multi-tenant. "We're past 'does it work' — A2 says it works. We're raising to
  distribute."

**Backup Q&A:** privacy (RLS + 0 cross-tenant, no LLM keys in frontend), accuracy (100% citation,
no uncited numbers), defensibility (graph + provenance + governance), unit economics (server-side
cost meter; $4/day cap in beta).
