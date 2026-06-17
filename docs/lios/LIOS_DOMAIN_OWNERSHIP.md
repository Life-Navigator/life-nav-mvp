# LIOS Domain Ownership (Phase 8)

**Thesis: one system of record per entity, no duplication, no ambiguity.** Each life entity
belongs to exactly one domain. Other domains may _read_ and _reference_ it (the life graph lets
edges cross domains), but only the owning domain is the **system of record** — the one place that
entity is written, validated, and authoritatively summarized. Where two domains plausibly touch
the same noun (insurance, benefits), this document defines the **seam**: who owns the dollars,
who owns the coverage, and how they reference each other.

Legend: **EXISTS** = boundary enforced in code today · **PARTIAL** = mostly there, one
overlap to resolve · **NEW** = boundary asserted here, not yet enforced.

---

## 0. The five live domains and their routers/services

| Domain    | Router                                              | Service                    | Live?               |
| --------- | --------------------------------------------------- | -------------------------- | ------------------- |
| Finance   | `app/routers/finance.py` (`/v1/finance`)            | `app/domains/finance.py`   | EXISTS (registered) |
| Health    | `app/routers/health_domain.py` (`/v1/health`)       | `app/domains/health.py`    | EXISTS              |
| Career    | `app/routers/career_domain.py` (`/v1/career`)       | `app/domains/career.py`    | EXISTS              |
| Education | `app/routers/education_domain.py` (`/v1/education`) | `app/domains/education.py` | EXISTS              |
| Family    | `app/routers/family_domain.py` (`/v1/family`)       | `app/domains/family.py`    | EXISTS              |

Liveness is governed by `DomainRegistry` (`app/domains/registry.py`): only **registered**
services are live; the other roadmap domains (`goals`, `risk`, `calendar`, `roadmap`,
`scenarios`) appear only as names via `unavailable()` and **never return fake data**. This is the
"no mock data — ever" rule expressed at the domain layer.

---

## 1. Ownership map (system of record per entity)

### Finance — owns the money

**Retirement · Investments · Insurance ($ adequacy) · Estate (financial) · Cash flow · Debt**

| Entity                                                   | System of record (endpoint / table)                                                                                                   | Status           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Retirement                                               | `/v1/finance/retirement`, `/v1/finance/retirement-projection`, `/v1/finance/plan`; `financial_accounts` (investment/retirement types) | EXISTS           |
| Investments                                              | `/v1/finance/investments`; `financial_accounts`                                                                                       | EXISTS           |
| Cash flow                                                | `/v1/finance/cash-flow`, `/v1/finance/transactions`                                                                                   | EXISTS           |
| Net worth (canonical)                                    | `/v1/finance/canonical-summary`, `/v1/finance/net-worth` — **the ONE net-worth source** every widget reads                            | EXISTS           |
| Debt                                                     | `/v1/finance/debt`                                                                                                                    | EXISTS           |
| Insurance — **dollar adequacy** (life/disability $ need) | computed in `comp_benefits` (`insurance_impact.life`: coverage / need_10× / gap)                                                      | PARTIAL (see §3) |

### Health — owns the body & coverage

**Healthcare · Benefits (healthcare) · Wellness · Medical planning**

| Entity                                                 | System of record                                                                     | Status |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------ |
| Health profile / vitals / labs                         | `/v1/health/profile`, `/vitals`, `/labs`; `health_profiles`, `vitals`, `lab_markers` | EXISTS |
| Wellness (habits/activity/sleep/nutrition/supplements) | `/v1/health/{habits,activity,sleep,nutrition,supplements}`                           | EXISTS |
| **Healthcare insurance / coverage**                    | `/v1/health/insurance`; `health_insurance_plans`                                     | EXISTS |
| HSA / FSA (pre-tax healthcare accounts)                | `/v1/health/hsa-fsa`; `health_spending_accounts`                                     | EXISTS |
| Medical planning                                       | `/v1/health/intelligence`, `/v1/health/safety-check` (deterministic medical-safety)  | EXISTS |

### Career — owns the work

**Employment · Compensation · Promotion · Job changes**

| Entity                         | System of record                                  | Status |
| ------------------------------ | ------------------------------------------------- | ------ |
| Compensation                   | `/v1/career/compensation`; `compensation_records` | EXISTS |
| Market position                | `/v1/career/market-position`                      | EXISTS |
| Employment / roles / promotion | `/v1/career/{collection}` generic list routes     | EXISTS |

### Education — owns learning

**Degrees · Certifications · Learning**

| Entity                      | System of record                                         | Status |
| --------------------------- | -------------------------------------------------------- | ------ |
| Programs / ROI / comparison | `/v1/education/comparison`, `/report`; education service | EXISTS |

### Family — owns the household

**Household · Dependents · Guardianship · Legacy/Estate (documents) · Pets**

| Entity                                                         | System of record                                        | Status |
| -------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| Members / dependents / pets / guardianship                     | `/v1/family/*` (CRUD)                                   | EXISTS |
| **Estate / trust / beneficiary / survivor / legacy readiness** | `/v1/family/office` (Family Office; "not legal advice") | EXISTS |
| Estate _documents_ (will, POA, directive…)                     | Family Office `estate_readiness` (in_place / missing)   | EXISTS |

---

## 2. Cross-domain coordination via the graph

Entities are owned by one domain; **relationships cross domains**, and the life graph is where
that crossing is represented — with provenance (see `LIOS_PROVENANCE_ARCHITECTURE.md`).

- A recommendation declares `impacted_domains[]` (e.g. the GI-Bill rec touches
  `["finance", "career", "education"]`, `recommendations_os.py:366`) — but it has exactly one
  `source_module` and `category`, i.e. **one owner, many readers**. This is the ownership-vs-impact
  distinction made concrete: _ownership = who writes/authoritatively summarizes; impact = who is
  affected._ **EXISTS.**
- The advisor may only assert a cross-domain relationship if a **real graph edge** backs it
  (`advisor_validator._check_relationships`); `/v1/life-graph/workspace` renders only real
  cross-domain edges with citations. So cross-domain coordination is _evidence-gated_, not
  free-form. **EXISTS.**
- **Rule (NEW, to enforce):** when domain B needs an entity owned by domain A, it must **read A's
  canonical summary**, never re-derive or re-store the value. Finance already models this: every
  net-worth widget reads `/v1/finance/canonical-summary` rather than recomputing — extend that
  pattern to the seams below.

---

## 3. Overlaps to resolve (the seams)

These are the only nouns two domains both touch. Each gets one rule.

### Seam A — Insurance (Finance vs. Health) — **PARTIAL**

- **Finance owns the dollars of life/disability protection.** The protection-gap calculation
  (`coverage` vs `need_10x_income` vs `gap`) is a _financial adequacy_ question, produced by
  `comp_benefits` and consumed by the recs engine (`recommendations_os.py:274-293`).
- **Health owns healthcare coverage** — the actual medical plan and pre-tax healthcare accounts:
  `health_insurance_plans` (`/v1/health/insurance`) and `health_spending_accounts`
  (`/v1/health/hsa-fsa`).
- **Existing ambiguity to fix:** the life-insurance _protection-gap_ recommendation is currently
  emitted with `source_module="family_office"` and `category="family"`
  (`recommendations_os.py:281`). Per the ownership map, **life/disability dollar adequacy is
  Finance's**, while the _survivor/beneficiary_ framing is Family's. Resolution:
  - **Finance** = system of record for life/disability **coverage amounts and the $ gap**.
  - **Family** = system of record for **who is protected** (beneficiaries, survivor plan,
    guardianship) and references Finance's coverage figure via the graph.
  - **Health** = system of record for **healthcare** coverage + HSA/FSA only.
  - Action (NEW): re-home the protection-gap rec's `category` to `finance` (keep `impacted_domains`
    spanning finance+family) so net-worth/insurance dollars have one owner.

### Seam B — Benefits (Health vs. Career) — **PARTIAL**

The word "benefits" is overloaded. Split it:

- **Career owns compensation & equity benefits** — base, bonus, equity/RSUs, comp records
  (`/v1/career/compensation`, `compensation_records`). `comp_benefits.analyze()` produces
  `total_compensation` which Career is system of record for.
- **Health owns healthcare benefits** — medical plan, HSA/FSA (`health_spending_accounts`).
- **Seam:** the **401(k) employer match** is computed in `comp_benefits` (from a
  `401k_statement` document) but is a **retirement/Finance entity** — the headline rec is emitted
  with `category="finance"`, `source_module ∈ {comp_benefits, financial_planning}`
  (`recommendations_os.py:245-262`). That is correct: _the comp-benefits service is a producer,
  Finance is the owner._ Rule (NEW to assert): a service that _computes_ across domains
  (`comp_benefits`) is **not** an owner — it must always stamp the owning domain in `category`.

### Seam C — Estate (Finance vs. Family) — **EXISTS, clarified**

- **Family owns estate documents & decision authority** — will/POA/directive presence and the
  "who decides / who inherits" picture (`/v1/family/office`, `estate_readiness`;
  `recommendations_os.py:296-316`). The recs are correctly `DEPENDENCY` (document gaps),
  never "see an attorney" advice, with `category="family"`.
- **Finance owns the assets that flow through the estate** (accounts, net worth). The estate plan
  _references_ Finance's balances via the graph; it does not store them.
- This seam is already clean in code; the only rule is the general one — Family reads Finance's
  canonical balances, never copies them.

### Seam D — GI Bill / education funding (Military → Education/Finance) — **EXISTS**

The military GI-Bill rec spans `["finance", "career", "education"]` (`recommendations_os.py:366`)
but has a single `category="military"` source. Military is a _producer_; the funded outcome is an
Education entity (the program) and a Finance entity (tuition $). No re-storage — impact only.

---

## 4. Ownership rules (the invariants)

1. **One owner per entity.** Every entity maps to exactly one domain's router + table (§1). If
   two domains both want to write it, it is mis-modeled — split it (insurance → $ adequacy vs.
   healthcare coverage; benefits → comp/equity vs. healthcare). **EXISTS for the 5 domains;
   PARTIAL at seams A & B.**
2. **Readers reference, owners write.** A cross-domain need is satisfied by reading the owner's
   canonical summary (Finance's `/canonical-summary` is the template), never by re-deriving or
   duplicating the value. **EXISTS for net worth; NEW to generalize.**
3. **Producers are not owners.** A service that computes across domains (`comp_benefits`,
   `military`) must stamp the _owning_ domain in `category` and the affected ones in
   `impacted_domains`. **PARTIAL** (mostly correct; the life-insurance gap rec is the one to
   re-home — Seam A).
4. **Relationships are graph edges, gated by evidence.** No domain may assert a connection to
   another domain's entity without a real, cited graph edge
   (`advisor_validator._check_relationships`; `/v1/life-graph` real-edges-only). **EXISTS.**
5. **No fake data at any boundary.** Unregistered domains return metadata only
   (`DomainRegistry.unavailable()`); empty inputs yield honest empty states or `DEPENDENCY`
   recommendations, never fabricated values. **EXISTS.**

---

## 5. Resolution backlog (NEW)

| Seam          | Action                                                                                                                                                                          | Files                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A — Insurance | Re-home the life-protection-gap rec `category` from `family` → `finance` (keep `impacted_domains=["finance","family"]`); make Family reference Finance's coverage figure        | `recommendations_os.py:281`                                                     |
| B — Benefits  | Assert the producer-not-owner rule for `comp_benefits` outputs; verify every cross-domain rec stamps the owning `category`                                                      | `recommendations_os.py` (comp_benefits/military emit sites), `comp_benefits.py` |
| Rule 2        | Generalize the canonical-summary read pattern: define a `read_canonical(domain)` contract so Health/Career/Family read Finance balances (and each other) instead of re-deriving | domain services                                                                 |
| Rule 3        | Add a lint/test: every emitted rec's `category` ∈ the 5 owner domains, and `source_module` producers never set a foreign-domain authoritative summary                           | recs tests                                                                      |

Everything in §1–§2 is enforced today. The seams (§3 A & B) are the only places ownership is
currently _ambiguous_; §5 closes them without adding new stores — only re-homing a category and
generalizing the existing canonical-read pattern.
