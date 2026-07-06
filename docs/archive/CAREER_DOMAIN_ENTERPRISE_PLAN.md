# CAREER DOMAIN — ENTERPRISE PLAN

Career is a **decision-intelligence domain**, not a job board. It answers "what is the
highest-leverage move for my career and life right now?" using the proven Finance/Health
platform (DOMAIN_FRAMEWORK, RECOMMENDATION_FRAMEWORK, the 15 GRAPH_QUALITY_GATES,
enum-before-trigger, 116-RLS, evidence graph). Design only.

## Vision

Turn a user's experience, skills, credentials, and market signal into ranked, evidence-backed
moves (skill up, certify, target a role, change employer, negotiate) — each scored against the
user's financial, family, and life goals, and each traceable to a fact.

## Core outcomes

Career advancement · compensation growth · skill development · credential planning · promotion
readiness · opportunity readiness · employment-risk reduction · goal-achievement acceleration.

## Entities (domain nouns)

`CareerProfile · CareerGoal · ExperienceRecord · Skill · SkillGap · Certification · Degree ·
Credential · Resume · Portfolio · Employer · Industry · Role · Opportunity · JobApplication ·
Interview · CompensationRecord · CompensationProjection · MarketDemand · HiringTrend ·
CareerRecommendation`. (`Skill`, `Certification`, `Degree` are shared with Education — defined
once in the ontology standard, owned jointly.)

## User outcomes (what the user gets)

- A **market-value estimate** for their current profile + the lift from each move.
- A **skill-gap map** to a target role with the cheapest/fastest closers.
- **Ranked career moves** (certify vs degree vs lateral vs negotiate) scored on comp lift,
  time, risk, and goal fit — with the evidence behind each.
- **Employment-risk** signal (role saturation, industry decline) with mitigations.

## Recommendation families

`close_skill_gap` · `pursue_certification` · `target_role` · `negotiate_compensation` ·
`change_employer` · `change_industry` · `employment_risk_mitigation` · `promotion_readiness` ·
`credential_roi` (degree/cert worth it for the target role?).

## Evidence graph (inherits the shared model)

```
(:UserProfile)-[:HAS_CAREER]->(:CareerProfile)
(:UserProfile)-[:PURSUING]->(:CareerGoal)
(:UserProfile)-[:HAS_SKILL]->(:Skill)   (:UserProfile)-[:HAS_EXPERIENCE]->(:ExperienceRecord)
(:CareerGoal)-[:TARGETS_ROLE]->(:Role)
(:Role)-[:REQUIRES_SKILL]->(:Skill)     (:Skill)-[:GAP_FOR]->(:CareerGoal)
(:Certification)-[:CLOSES_SKILL_GAP]->(:Skill)   (:Certification)-[:QUALIFIES_FOR]->(:Role)
(:CareerGoal)-[:IMPROVES_COMPENSATION]->(:CompensationRecord)
(:CareerRecommendation)-[:HAS_EVIDENCE|HAS_ASSUMPTION|HAS_TRADEOFF|REQUIRES_REVIEW]->(...)
```

Recommendations fan out into Evidence/Assumption/Tradeoff/AdviceBoundary exactly like Finance.

## Governance boundaries

`boundary_type: "career_guidance"` — coaching only, **not** legal employment advice, **not**
a guarantee of hire/comp. Escalation `career_coach`/`recruiter` when the user asks for
contract/visa/discrimination/legal matters → refuse + refer. Compensation figures must cite a
source band (never a fantasy salary — see COMPENSATION_INTELLIGENCE_ENGINE).

## Graph quality requirements

Same 15 gates: enum-before-trigger; typed edges (no RELATED_TO for mapped types); Qdrant
payload (tenant/user/entity_type/source_table/title/sensitivity); :Unknown=0; cross-tenant=0;
node-count reconcile; recommendations carry evidence; chat cites evidence; unlock only at 15/15.

## What must never be guessed / requires citation

- Compensation numbers → must reference a `CompensationBand` source (BLS/market feed), with
  confidence; never invented.
- Hiring demand / role saturation → from `MarketDemand`/`HiringTrend` sources.
- "This cert qualifies you for role X" → from a credential→role mapping, not assumption.
