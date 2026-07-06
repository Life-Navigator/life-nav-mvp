# Advisor Demo Script — LifeNavigator

**Audience:** financial advisors / CPAs / RIAs (design-partner pilot) · **Length:** ~10 min
**Thesis:** LifeNavigator does the cited prep work; you keep the relationship and the judgment.
A governed, redacted, audit-logged report you can put in front of a client.

> Trust facts (A2 audit, live 2026-06-08): 100% citation coverage, 100% report reproducibility,
> 0 cross-tenant edges, per-access audit log on every shared view.

---

## 0. Framing (45s)

"You spend hours assembling a client's full picture before you can advise. LifeNavigator hands
you that picture — **already cited, already reproducible** — and a **share link you control**.
It never gives advice; it escalates legal/medical/tax to you. It's leverage, not a replacement."

## 1. The whole-client snapshot (2 min) — `/dashboard/readiness`

- Life Readiness Index + 6 domains, color-coded. "At a glance: this client is RED on Family —
  a **$1.0M protection gap** computed from their income — and YELLOW on Finance (emergency-fund
  gap). You'd have spent an hour finding that."
- Each card: the gap, a confidence, a timeline, the top recommendation — **every figure cited**.

## 2. Compensation & ROI you can defend (2 min)

- Career: market value cites **"BLS OEWS May 2024"**. Education: ROI cites **College Scorecard**
  program earnings. "No fantasy salaries. If we don't have a cited band, we say so — we never
  invent a number."
- Open the **provenance registry**: BLS OEWS, O\*NET, ACS, College Scorecard, IPEDS — each with a
  source URL + as-of date + refresh cadence.

## 3. The branded report (2 min)

- One click → the **Education PDF**: cover, exec summary, ranked program comparison, ROI with
  charts, family impact, risk, **evidence appendix + citations**, and a boundary footer
  ("not admissions/financial/legal advice").
- "Regenerate it — identical content hash. It's **reproducible and auditable**. You can hand it
  to a client or a compliance reviewer."

## 4. Governed sharing — the part compliance loves (2.5 min)

- From the report, **create a share for an advisor/CPA** (set 14-day expiry).
- Open the link **with no login** → the client's report, **redacted to your audience's scope**
  (e.g., a parent share hides finances; a CPA share hides health/family).
- **Revoke** it → the link immediately returns **410 Gone**.
- Show the **audit log**: every access stamped (granted/revoked/expired). "Consent ledger +
  redaction + expiration + full audit trail. Client data never leaves your control."

## 5. "What changed this month?" (1 min)

- Finance trends: net-worth/cash-flow/debt over time + change detection. "Between reviews, you
  see the deltas — a built-in talking point for the next client call."

## 6. The pitch to the advisor (30s)

- "You bring the book and the judgment; we bring the cited prep, the branded deliverable, and the
  governed sharing. Join the design-partner pilot — 3 clients, 30 days, your feedback shapes it."

**Boundaries to emphasize:** estate/guardianship → "consult an attorney"; medical → blocked;
tax → escalate. LifeNavigator is decision _support_, and it says so on every artifact.
