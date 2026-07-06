# FAMILY_TIMELINE.md — Sprint A

**Goal:** A "what changed" feed that makes the platform's work **visible** — proving LifeNavigator is _actively_ helping. **Derived entirely from existing timestamps. No new table, no new infra.**

## Why a timeline

Success Criteria #3–4: "Watch the platform update / See what changed." Today, when a user uploads a will or names a guardian, the readiness silently recomputes — the work is invisible. The timeline turns silent processing into a visible, trustable narrative.

## Data sources (all EXIST today — no schema added)

Every family object and intelligence artifact already carries `created_at` / `updated_at`. The timeline is a **read-only union** over existing rows:

| Event type                        | Source (existing)                                                         | Rendered as                                                                     |
| --------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Document uploaded + extracted     | `documents.documents.created_at` + `document_fields` (provenance via 165) | "Will uploaded — executor, guardian, 3 beneficiaries extracted" + Evidence link |
| Field confirmed/edited/rejected   | `documents.document_fields.review_status` + `extracted_at` (165)          | "You confirmed the beneficiary on your life policy"                             |
| Conflict detected/resolved        | `documents.field_conflicts.created_at / resolved_at` (166)                | "Conflict flagged: two coverage amounts — needs your review"                    |
| Resume/record imported            | `documents.resume_items.imported_at` (167)                                | (career, but same feed pattern)                                                 |
| Recommendation generated/accepted | `family.family_recommendations.created_at / accepted_at / rejected_at`    | "New: name a guardian for your dependents"                                      |
| Readiness changed                 | `life.readiness_snapshots` (migration 163, live)                          | "Estate readiness 50 → 75 after your will upload"                               |
| Family object added               | `family.{family_members,beneficiaries,guardianship,…}.created_at`         | "Added dependent: Maya (age 7)"                                                 |
| Insurance/estate updated          | `family.{insurance_profiles,estate_plans}.updated_at`                     | "Life coverage set to $1.0M — survivor gap closed"                              |

## Implementation (surfacing only)

- **Backend:** one read endpoint `GET /v1/family/timeline` that UNION-orders the above sources by timestamp (descending), each row → `{ts, type, title, detail, domain, evidence_ref?, delta?}`. Pure SELECT over existing tables; **no migration**.
- **Frontend:** a `FamilyTimeline` component on the Overview (and a full Timeline tab). Vertical feed, newest first, grouped by day, each entry with an icon, a one-line human sentence, and (where applicable) a **delta chip** ("Estate 50→75") and a **provenance link** to the Evidence drawer.
- **Empty state:** "Your family timeline starts with your first upload or entry — every change LifeNavigator makes shows up here."

## The "what changed after upload" moment (the demo centerpiece)

When a user uploads a will, the timeline must, within the same session, show a coherent cluster:

1. "📄 Will uploaded"
2. "🔎 Extracted: executor, guardian, 3 beneficiaries" (with confidence chips + Evidence link)
3. "📈 Estate readiness 50 → 75" (readiness_snapshots delta)
4. "✅ Resolved: 'no will on file' risk"
5. "🧭 New recommendation: confirm beneficiary designations match the will"

This sequence is generated from real events — it is the literal proof of Success Criteria #4–9 ("see what changed → understand risks → understand next move → why Arcana believes it → trust it").

## Honest-change rules

- Only render an event that has a real backing row (no synthetic "we analyzed your data" filler).
- Deltas only when a `readiness_snapshots` pair exists; otherwise show the absolute new state.
- Conflicts surface as their own honest events — never hidden to make the feed look clean.

## NOT in scope

Predictive/future timeline ("you'll need X in 2030"), calendar reminders, notifications/email digests. Those are features, not surfacing — deferred. This sprint ships the **retrospective change feed** from existing data.

## Acceptance

Uploading a will produces, with zero new schema, a 4–5 entry timeline cluster (upload → extraction → readiness delta → risk cleared → next rec), each entry traceable to a real row and (where relevant) one-click to its evidence.
</content>
