# Semantic Governance

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phase 9. Depends on `PROVENANCE_MODEL.md` (classification needs origin) and closes
architecture finding **C-2**.

---

## 1. The governing finding (C-2)

`relationship_catalog.rs` declares `permitted_contexts` and `permitted_principals` in **150 places**,
with the explicit design statement that _"traversability is a per-context policy, not a Boolean."_ The
exported `ontology_manifest.json` contains **zero** occurrences of either field. The Python planner
reads one boolean meaning _personal-advisor-traversable_.

The Rust model is correct and fails closed. **The export is lossy**, so the serving tier cannot express
per-principal authorization at all. Every requirement in this document and in
`MULTI_AGENT_SEMANTIC_ARCHITECTURE.md` is blocked behind fixing it.

This is not a hypothetical risk today — with one principal, the flattened boolean is _safe_. It becomes
a breach vector the moment a second principal (provider agent, compliance agent, support tooling)
consumes the manifest and finds only a boolean that already answered "yes" for the personal advisor.
**Fix it before the second principal exists, not after.**

---

## 2. Automatic classification

Every graph object receives a `privacy_class` derived from its node class and provenance — never
hand-assigned per instance, which does not scale and drifts.

| Class       | Sources                          | Examples                                                        | Handling                                                       |
| ----------- | -------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `PHI`       | health domain, medical documents | `HealthProfile`, `BodyMetric`, `HealthGoal`                     | strictest; excluded from cross-domain reasoning by default     |
| `FINANCIAL` | Plaid, statements                | `FinancialAccount`, `TransactionSummary` (1,431 nodes, **57%**) | masked in logs, never in prompts verbatim                      |
| `PII`       | identity, contact                | `UserProfile`, `SpouseProfile`                                  | pseudonymized in all telemetry                                 |
| `LEGAL`     | wills, estate, guardianship      | `EstatePlan`, `GuardianshipPlan`                                | citation requires human-reviewed provenance                    |
| `FAMILY`    | dependents, relationships        | `Dependent`, `FamilyProfile`                                    | may describe **third parties who are not the tenant** — see §3 |
| `PROVIDER`  | B2B service relationships        | provider/Arcana edges                                           | **never traversable from personal retrieval**                  |
| `DERIVED`   | AI-generated                     | `*Recommendation`, `Assumption`                                 | must be labelled as system-generated wherever surfaced         |
| `PUBLIC`    | reference data                   | `School`, `Program`                                             | freely traversable, freely citable                             |

Classification is catalog data (I-9), regenerated with the manifest and drift-gated. A new node class
without a declared `privacy_class` is a **build failure**, not a default to `PUBLIC`.

---

## 3. The third-party data problem

`Dependent`, `SpouseProfile`, and `Provider` nodes hold data about **people who are not the tenant and
never consented to this platform**. Production holds 6 dependents, 1 spouse, 53 family profile nodes.

This is a genuine compliance exposure that generic knowledge-graph governance frameworks miss, because
they assume the data subject is the account holder. Rules:

1. Third-party attributes are `FAMILY`-classed and inherit the **strictest** retention of any subject
   they describe.
2. A third party's data may inform advice **to the tenant** but may never be exported, shared, or
   surfaced in any collaboration feature without a separate consent record.
3. A deletion request from the tenant cascades to third-party data they supplied.
4. A third party has no account and therefore cannot exercise rights directly — so the platform must be
   able to **enumerate and export everything it holds about a named non-user** on request. That is a
   query requirement, and it is only satisfiable with the provenance layer.

---

## 4. The policy decision point

One evaluator, consulted by retrieval, reasoning, and every agent:

```
decide(principal, context, action, assertion, as_of) -> Allow | Deny(reason)
```

`action ∈ {traverse, cite, reason_over, export, mutate}` — the five distinct permissions the brief
requires. They are genuinely independent:

- An assertion may be **traversable** (it shapes retrieval) but **not citable** (unreviewed extraction).
- It may be **citable** but **not reason-over-able** (a legal disclaimer must be quoted, never acted on).
- It may be **reason-over-able** but **not exportable** (third-party family data).

Collapsing these into one "can access" boolean forces a wrong answer in at least one direction, which
is exactly what the flattened manifest does today.

**Fail closed at every level.** Unknown principal → deny. Unknown context → deny. Unclassified
assertion → deny. Missing policy row → deny. This mirrors `spec_for → None` = refuse, already the
established and correct pattern in the Rust catalog.

**One implementation.** The precedent to avoid is on record: `verify_jwt` duplicated across two Python
tiers, already diverging. A policy engine that is duplicated will diverge, and a diverged policy engine
is a breach with an audit trail that says it was authorized.

---

## 5. Retention, deletion, masking

| Class       | Retention                              | Deletion             | Cascade                            |
| ----------- | -------------------------------------- | -------------------- | ---------------------------------- |
| `PHI`       | tenant lifetime + 0                    | hard delete          | assertions + vectors + provenance  |
| `FINANCIAL` | tenant lifetime + 7y (regulatory)      | tombstone, then hard | assertions retained, values purged |
| `PII`       | tenant lifetime                        | hard delete          | full cascade incl. embeddings      |
| `LEGAL`     | tenant lifetime + 7y                   | tombstone            | provenance retained                |
| `FAMILY`    | strictest of subjects                  | hard delete          | full cascade                       |
| `DERIVED`   | regenerable — no independent retention | delete freely        | recompute on demand                |
| `PUBLIC`    | indefinite                             | n/a                  | n/a                                |

**`DERIVED` is deletable precisely because it is reconstructible.** This is a concrete payoff of the
provenance layer: AI-generated knowledge need not be retained through a deletion request, because it
can be regenerated from surviving evidence. Without provenance, derived knowledge must be treated as
irreplaceable and retained — the worse outcome on every axis.

### 5.1 Deletion must span four stores

Neo4j, Qdrant, Postgres, and object storage. A deletion that clears the graph but leaves the embedding
is a **breach with a compliance report claiming success** — the exact silent-success failure class as
`domain=finance` returning zero and looking healthy.

Deletion therefore emits a machine-readable completion artifact with per-store counts, and
reconciliation verifies zero residue in all four. Nothing reports success on the basis of one store.

---

## 6. Audit

Every policy decision is logged: principal, context, action, assertion id, verdict, reason, policy
version, timestamp. Hashed tenant ids; never raw values; never the asserted content itself.

Denials are as important as grants. A rising denial rate for a given agent is the earliest signal that
an agent is drifting toward data it should not want — the detection mechanism for the brief's _"No
agent should infer unrestricted graph access."_

---

## 7. Migration

| Step | Action                                                                      | Rollback                 |
| ---- | --------------------------------------------------------------------------- | ------------------------ |
| 1    | **Extend manifest export with full policy surface (closes C-2)**            | dual-emit; revert reader |
| 2    | Planner reads `is_traversable_in(rel, context, principal)`                  | revert to boolean        |
| 3    | Declare `privacy_class` per node class; build gate on missing               | remove gate              |
| 4    | Policy decision point, shadow mode — decisions logged, not enforced         | it is already inert      |
| 5    | Compare shadow denials against current behaviour; triage every disagreement | —                        |
| 6    | Enforce behind `POLICY_ENFORCEMENT`, per-action rollout                     | disable flag             |
| 7    | Deletion cascade across four stores, dry-run first                          | —                        |

**Step 5 is mandatory and must not be skipped.** Turning on a policy engine that has never been
compared against live behaviour converts every classification error into an outage or a leak. Shadow
mode is how the number-gate work should have been done and is the pattern to repeat.

---

## 8. Evaluation

| Metric                      | Gate                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| Classification completeness | 100% of node classes have `privacy_class` — build gate               |
| Manifest policy fidelity    | exported fields == catalog-declared fields — **CI gate, closes C-2** |
| Cross-tenant traversal      | **0**, property-tested                                               |
| Provider→personal leakage   | **0**, property-tested                                               |
| Deletion completeness       | 0 residue across all four stores, dry-run verified                   |
| Policy determinism          | identical inputs → identical verdict, 100%                           |
| Denial-rate anomaly         | per-agent baseline, alert on deviation                               |
| Audit completeness          | every decision logged — 100%, no sampling                            |
