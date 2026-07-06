# EDUCATION — ONTOLOGY SPEC

Education nodes + relationships for the worker ontology registry, following the proven pattern
(`ontology::incoming_edges` rules; user-anchor + PayloadFk; no RELATED_TO for mapped types;
edges point INTO the processed node per `merge_cypher_for`). Design only.

## Nodes (PascalCase labels)

`EducationProfile · EducationGoal · School · Program · DegreeOption · Certification · Course ·
TuitionCost · FinancialAidOption · Scholarship · EducationCostScenario · EducationROIModel ·
ProgramOutcome · AccreditationRecord · LicensingRequirement · EducationRecommendation ·
EducationComparisonReport · Evidence · Assumption · Tradeoff · AdviceBoundary`.
(`Skill`, `Certification` shared with Career; `Evidence/Assumption/Tradeoff/AdviceBoundary`
shared platform nodes.)

## Relationship vocabulary (extends LIFENAVIGATOR_ONTOLOGY_STANDARD)

`HAS_EDUCATION · PURSUING · EVALUATES · OFFERED_BY · HAS_TUITION_COST · HAS_OUTCOME ·
HAS_ACCREDITATION · REQUIRES (licensing) · BUILDS_SKILL · CLOSES_SKILL_GAP · QUALIFIES_FOR ·
FUNDED_BY · IMPACTS · HAS_ROI_MODEL · ADDRESSES · HAS_EVIDENCE · HAS_ASSUMPTION · HAS_TRADEOFF ·
REQUIRES_REVIEW · COMPILES_INTO (report)`.

## Registry rules (source → REL → target; direction matches merge_cypher_for)

| Source → REL → Target                                                                  | Emit when                               |
| -------------------------------------------------------------------------------------- | --------------------------------------- |
| UserProfile → HAS_EDUCATION → EducationProfile                                         | always (user anchor)                    |
| UserProfile → PURSUING → EducationGoal                                                 | always                                  |
| EducationGoal → EVALUATES → Program                                                    | `program_id` FK on the goal/eval        |
| Program → OFFERED_BY → School                                                          | `school_id` FK                          |
| Program → HAS_TUITION_COST → TuitionCost                                               | `program_id` FK on cost                 |
| Program → HAS_OUTCOME → ProgramOutcome                                                 | `program_id` FK                         |
| Program → HAS_ACCREDITATION → AccreditationRecord                                      | FK                                      |
| Program → REQUIRES → LicensingRequirement                                              | FK                                      |
| Program → BUILDS_SKILL → Skill                                                         | skill linkage                           |
| Certification → CLOSES_SKILL_GAP → Skill                                               | skill linkage                           |
| Program → QUALIFIES_FOR → JobTarget                                                    | role linkage (cross-domain, Career)     |
| EducationROIModel → EVALUATES → Program                                                | `program_id` FK                         |
| Program → FUNDED_BY → FinancialGoal                                                    | funding linkage (cross-domain, Finance) |
| Program → IMPACTS → CashFlowSnapshot / NetWorthSnapshot                                | snapshot linkage (Finance)              |
| EducationRecommendation → ADDRESSES → EducationGoal                                    | `addresses_entity_id`                   |
| EducationRecommendation → HAS_EVIDENCE/HAS_ASSUMPTION/HAS_TRADEOFF/REQUIRES_REVIEW → … | fan-out (same as Finance/Health)        |
| EducationComparisonReport → COMPILES_INTO → EducationRecommendation                    | report linkage                          |

## Direction note (the recurring constraint)

Edges whose **processed node is the source** (e.g. `Program → OFFERED_BY → School` while
processing Program) need the outgoing-edge form OR are emitted from the other side. Per the
finance/health precedent (SECURED_BY, COVERED_BY), the **user-anchor + child-into-parent**
edges (HAS_EDUCATION, PURSUING, HAS_RECOMMENDATION, and the recommendation fan-out) are emitted
directly; the **catalog inter-entity edges** (OFFERED_BY, HAS_TUITION_COST, EVALUATES) are
implemented via the worker's child fan-out when processing the program/report (which knows the
FKs) OR documented as extension points until outgoing-edge support lands. **No fake edges.**

## Recommendation fan-out (inherited, already generic)

`expand_children` already fans out ANY `*_recommendation` (finance/health) into typed
Evidence/Assumption/Tradeoff/AdviceBoundary linked to the recommendation's own label. Adding
`EducationRecommendation` to the enum + the fan-out guard makes the Education evidence graph
work with zero new fan-out code (the H2 generalization already covers it).

## Cross-domain rule

No cross-domain edge (Program→JobTarget, Program→FinancialGoal, Program→CashFlowSnapshot) is
emitted unless **both** endpoint domains are live + the FK exists. Education unlocks before its
Career/Finance bridges light up only where the target nodes exist.

## Quality

Every Education entity registry-mapped (no RELATED_TO); :Unknown=0; tenant-safe; enum-before-
trigger; the 15 gates apply unchanged.
