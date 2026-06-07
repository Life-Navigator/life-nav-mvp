# FAMILY DOMAIN SPEC (Elite buildout, Phase 4)

**Date:** 2026-06-07 · **Status:** DESIGN ONLY. Build order: Finance→Health→Career→**Family**→Education.

Family decision intelligence: household, dependents, protection, college planning, estate readiness.

---

## 1. Supabase tables

**Existing:** `public.family_members`, `public.family_appointments`.
**Missing (➕):** `public.household`, `public.dependents`, `public.family_goals`, `public.protection_items`, `public.insurance_needs`, `public.estate_readiness_items`, `public.family_recommendations`.
Pattern: migration-116; sensitivity Medium (some High for minors' data); `user_id` = the household owner.

## 2. Worker entity types

**Present:** `family_member`.
**Add (➕):** `household, dependent, family_goal, protection_item, insurance_need, estate_readiness_item, family_recommendation`, and `family_appointment` (its table is wired-ish; verify). Enum-before-trigger.
Labels: :Household, :FamilyMember, :Dependent, :FamilyGoal, :ProtectionItem, :InsuranceNeed, :EstateReadinessItem, :FamilyRecommendation.
Relationships: (:UserProfile)-[:HEADS]->(:Household)-[:INCLUDES]->(:FamilyMember|:Dependent); (:Household)-[:HAS_PROTECTION]->(:ProtectionItem); (:Dependent)-[:NEEDS]->(:InsuranceNeed); (:FamilyGoal)-[:FUNDED_BY]->(:FinancialGoal) (cross-domain to Finance); (:Household)-[:HAS_ESTATE_ITEM]->(:EstateReadinessItem). Freshness: on-change.

## 3. Backend endpoints (`domains/family.py`)

```
GET  /v1/family/summary  /members  /goals  /protection  /recommendations
POST /v1/family/member  /goal  /protection-item
```

`protection` returns insurance coverage vs need (gap analysis); summary surfaces dependents, upcoming appointments, protection gaps.

## 4. UI surfaces

Family Overview (hero: household snapshot, dependents, protection-gap count, upcoming key dates, top risk, next move) · Household · Dependents · Protection Plan · College Planning (cross-links Education ROI + Finance goals) · Insurance Readiness · Estate Readiness · Family Recommendations.

## 5. Recommendations (H contract)

life-insurance-coverage-gap · dependent-care-planning · 529/college-funding-plan (cross-domain Finance+Education) · estate-document-readiness (will/POA/directive) · beneficiary-review. **Boundaries:** no legal advice, no tax advice → `escalation = {type:"legal"|"tax", disclaimer:"consult an attorney/CPA"}` on relevant recs.

## 6. Chat

"Am I adequately insured for my family?" · "What do I need for college for [dependent]?" · "Is my estate plan ready?" · "What protection gaps do I have?" — grounded in household + dependents + protection_items + insurance_needs; legal/tax topics escalate.

**Unlock:** sidebar "Family" → live when summary renders real data.
