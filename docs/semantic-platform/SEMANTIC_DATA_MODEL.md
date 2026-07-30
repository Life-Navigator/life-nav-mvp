# Semantic Data Model

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phase 1. Audits every node type and relationship in production, defines the required
specification for each, and states the evolution rule.

---

## 1. Measured inventory

Production holds **47 node labels** and **40 live relationship types**, against a catalog of **147**
declared relationships. Full counts in `artifacts/graphrag-reconciliation/production_baseline.json`.

### 1.1 Node distribution (live)

| Tier            | Labels                                                                                                                                      | Nodes | Note                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------- |
| Anchor          | `UserProfile`                                                                                                                               | 268   | one per tenant; the traversal root |
| Financial       | `TransactionSummary`, `FinancialAccount`, `InvestmentHolding`, `NetWorthSnapshot`, `CashFlowSnapshot`                                       | 1,431 | **57% of all nodes**               |
| Persona         | `PersonaProfile`                                                                                                                            | 148   | unmapped in registry — see §5      |
| Career          | `CareerProfile`, `CareerGoal`, `UserSkill`, `Certification`, `JobTarget`, `CompensationRecord`, `CareerRecommendation`                      | 156   |                                    |
| Evidence        | `Evidence`, `Assumption`, `Tradeoff`, `AdviceBoundary`                                                                                      | 151   | reasoning-support tier             |
| Document        | `Document`, `DocumentField`                                                                                                                 | 75    | document intelligence              |
| Health          | `HealthProfile`, `BodyMetric`, `HealthGoal`, `SleepLog`, `ActivityLog`, `NutritionLog`, `HealthRecommendation`                              | 111   |                                    |
| Education       | `EducationProfile`, `EducationRecord`, `EducationGoal`, `Program`, `School`, `LearningPath`, `ProgramComparison`, `EducationRecommendation` | 76    |                                    |
| Family / Estate | `FamilyProfile`, `Dependent`, `SpouseProfile`, `GuardianshipPlan`, `EstatePlan`, `InsuranceProfile`, `FamilyRecommendation`                 | 68    |                                    |
| Decision        | `LifeDecision`, `DecisionScenario`, `Goal`                                                                                                  | 20    |                                    |

**Structural observation.** The graph is a **shallow star**: `UserProfile` at the centre, one hop to
domain profiles, one more to facts. `HAS_TRANSACTION` alone is 1,951 of 3,208 edges (61%). Average
degree excluding transactions is low. This matters for reasoning design — multi-hop causal chains have
little to traverse _today_, so Phase 7 capability will be gated by graph richness, not by algorithm
quality. `SEMANTIC_QUALITY_FRAMEWORK.md` §3 makes richness a tracked metric for this reason.

---

## 2. Node specification

Every node class must declare the twelve properties the brief requires. Declared **as catalog data**,
not as code (invariant I-9).

```rust
pub struct NodeClassSpec {
    // ── identity ────────────────────────────────────────────────
    semantic_identity:   &'static str,   // ontology class URI-style id, stable forever
    business_identity:   BusinessKey,    // natural key for dedup: e.g. Account{institution,mask}
    ontology_class:      OntologyClass,  // position in the class hierarchy
    source_system:       SourceSystem,   // Plaid | DocumentExtraction | UserStated | Advisor | Derived

    // ── lifecycle ───────────────────────────────────────────────
    lifecycle:           Lifecycle,      // proposed | implemented | deprecated | retired
    ownership:           Ownership,      // tenant | platform | provider | shared
    versioning:          VersionPolicy,  // immutable | mutable_versioned | mutable_overwrite

    // ── trust & time ────────────────────────────────────────────
    provenance:          ProvenanceReq,  // required | required_unless_synthetic | exempt
    temporal_validity:   TemporalBehavior, // see TEMPORAL_MODEL §2

    // ── governance ──────────────────────────────────────────────
    privacy_class:       PrivacyClass,   // PII | PHI | FINANCIAL | LEGAL | FAMILY | DERIVED | PUBLIC
    retention_policy:    RetentionClass,
    explainability:      ExplainabilityReq, // citable | citable_with_caveat | never_cited
}
```

### 2.1 Business identity is the deduplication contract

The brief's Phase 8 asks for duplicate detection and entity consolidation. Both are undecidable without
a declared natural key. `business_identity` is that declaration:

- `FinancialAccount` → `{institution_id, account_mask, tenant_id}`
- `Document` → `{content_hash, tenant_id}`
- `PersonaProfile` → `{tenant_id}` (singleton per tenant — which is why 148 tenants have exactly 1)
- `TransactionSummary` → `{account_id, period_start, period_end}`

**Where no natural key exists, the class declares `BusinessKey::None` and is explicitly excluded from
automatic merging.** Never fuzzy-merge a class that has not declared how it is identified. The brief's
Phase 8 requirement — _"never auto-merge below confidence — queue for review"_ — is enforced by making
the absence of a key a hard block, not a low score.

---

## 3. Relationship specification

The existing catalog row carries `rel_type`, `family`, `weight`, `lifecycle`, `traversable`,
`permitted_contexts`, `permitted_principals`. The brief requires thirteen properties. Extension:

| Property                | Type                                             | Purpose                                  | Exists     |
| ----------------------- | ------------------------------------------------ | ---------------------------------------- | ---------- |
| `semantic_meaning`      | prose + class                                    | what the edge asserts                    | via family |
| `causal_meaning`        | `causes｜enables｜prevents｜correlates｜none`    | powers causal traversal (Ph7)            | **new**    |
| `confidence_default`    | ConfidenceVector                                 | prior when extractor is silent           | **new**    |
| `evidence_requirement`  | `none｜document｜user_stated｜verified_db`       | what must exist to assert                | **new**    |
| `inference_status`      | `asserted｜inferred｜derived`                    | separates observed from computed         | **new**    |
| `assertion_status`      | `active｜disputed｜retracted｜superseded`        | contradiction handling                   | **new**    |
| `traversal_permissions` | contexts × principals                            | **exists in Rust, lost in export (C-2)** | partial    |
| `citation_policy`       | `citable｜caveated｜never`                       | what may appear in an answer             | **new**    |
| `reasoning_policy`      | `may_influence｜context_only｜excluded`          | may it change a recommendation           | **new**    |
| `temporal_behavior`     | see TEMPORAL §2                                  | point-in-time vs interval vs eternal     | **new**    |
| `merge_policy`          | `union｜latest_wins｜highest_confidence｜manual` | on entity consolidation                  | **new**    |
| `conflict_resolution`   | precedence rule                                  | contradictory assertions                 | **new**    |
| `retirement_policy`     | `hard_delete｜tombstone｜supersede`              | end of life                              | **new**    |

### 3.1 Why `citation_policy` and `reasoning_policy` must be separate

They are routinely conflated and must not be. An assertion may legitimately **inform** a recommendation
while being unfit to **quote** — an inferred risk signal, for example, or a third-party document field
below review threshold. The inverse also holds: a legal disclaimer is citable but must never influence
a recommendation.

Collapsing them forces one wrong answer in both directions. The existing `AdviceBoundary` node class
(21 live) is evidence the system already needs this distinction and currently expresses it as a
separate node rather than as edge policy.

### 3.2 `inference_status` is the synthetic-knowledge boundary

Invariant I-4 permits assertions without attributable origin **only** when explicitly classified
synthetic. `inference_status` is that classification. It also satisfies brief Phase 9's requirement to
distinguish AI-generated from human-authored knowledge — a distinction that must be queryable, because
regulators and users will ask _"did a human say this, or did your model?"_, and "we'd have to check the
code" is not an acceptable answer for a platform of record.

---

## 4. Ontology class hierarchy

Current ontology is **flat**: 147 relationship types in 7 families, no class hierarchy over node types.
Flatness costs generalization — a reasoner cannot infer that `CareerGoal` and `HealthGoal` are both
`Goal` and answer "what am I working toward?" across domains without hardcoding the list.

Proposed minimal hierarchy (deliberately shallow — deep hierarchies are where ontology projects die):

```
Thing
├── Actor          UserProfile, SpouseProfile, Dependent, Provider
├── Asset          FinancialAccount, InvestmentHolding, Property
├── Obligation     Debt, InsurancePolicy, GuardianshipPlan, EstatePlan
├── Objective      Goal, CareerGoal, HealthGoal, EducationGoal, CollegePlanning
├── Observation    TransactionSummary, BodyMetric, SleepLog, ActivityLog, NutritionLog
├── Artifact       Document, DocumentField, Report
├── Judgement      Evidence, Assumption, Tradeoff, AdviceBoundary, *Recommendation
└── Episode        LifeDecision, DecisionScenario, ProgramComparison
```

Three levels maximum. Each level must earn itself by enabling a query that flat classes cannot answer.
`Objective` immediately enables cross-domain goal reasoning; `Observation` enables uniform temporal
decay; `Judgement` enables "show me only what the system concluded, not what it was told" — which is
an explainability requirement, not a nicety.

---

## 5. Findings requiring action

**F-1 — `PersonaProfile` is unmapped (148 nodes, 148 fallback edges).** Classified `Domain::Root`,
absent from `REGISTRY`, so every persona ingest emits `RELATED_TO`. Full analysis and remediation
sequence in `RELATED_TO_REMEDIATION.md`. Fix is a catalog addition (`HAS_PERSONA`, ownership family)
plus source replay — **never a blind remap**.

**F-2 — 107 of 147 catalog relationships have zero live instances.** Not necessarily a defect: a young
corpus legitimately under-uses a forward-looking catalog. But it is unmeasured, and `unused ontology`
is an explicit Phase 5 metric. Track it; do not prune on it yet. Pruning a catalog because a young
graph has not populated it is how you delete the future.

**F-3 — Relationships carry no `tenant_id` (0/3,208).** Isolation rests on node properties alone.
Acceptable _if_ every traversal predicate is node-anchored and property-tested (invariant I-5). Must be
an explicit, tested guarantee rather than an emergent one.

**F-4 — No node carries `:Entity`.** The generic label has zero population, so any retrieval or
migration predicated on it matches nothing — the same silent-empty failure class as `domain=finance`.
Either populate it from a declared predicate or remove it from designs; do not leave it as a
half-present convention.

---

## 6. Evolution rule

> _"Assume new domains will appear every month."_

The rule that makes this survivable: **a new domain must be addable by adding catalog rows and node
class specs only — never by editing retrieval, traversal, policy, or planner code.**

Concretely, adding an Insurance domain must require:

1. node class specs for its labels
2. catalog rows for its relationships (family, policies, temporal behavior)
3. a domain vocabulary entry
4. regenerate manifests; drift gates verify

and must require **zero** edits to `planner.py`, `traversal.py`, `fusion.py`, or `engine.py`.

**If a new domain requires a code change in the retrieval path, the abstraction has failed** — that is
the test. The current architecture nearly passes: the planner derives families and weights from the
manifest. The one violation is `_DOMAIN_TERMS`, a hand-maintained lexicon in `planner.py` that a new
domain _would_ require editing. It should move to the generated domain manifest.

_Benefit:_ domain onboarding becomes data, not engineering.
_Complexity:_ Low.
_Risk:_ Low — mechanical move, drift-gated.
_Migration:_ emit terms into `domain_manifest.json`; planner reads; delete the dict.
_Rollback:_ restore the dict.
