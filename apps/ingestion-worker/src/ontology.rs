//! LifeNavigator ontology registry — the single source of truth, in code, for
//! which typed Neo4j relationships each entity emits. The human-facing spec is
//! `LIFENAVIGATOR_ONTOLOGY_STANDARD.md`; this module is its executable form.
//!
//! ## Why a registry
//! Relationship emission used to be a growing `match` in the normalizer. As more
//! domains arrive that becomes unmaintainable and easy to get wrong. The registry
//! makes a relationship a *declared rule* (data), not scattered control flow, so a
//! new domain adds rows here rather than editing the worker core.
//!
//! ## Edge direction
//! `Neo4jClient::merge_cypher_for` always emits `(target)-[rel]->(node)`, where
//! `node` is the entity being processed and `target` is the [`Relationship`]'s
//! `target_entity_type`/`target_entity_id`. So an [`IncomingEdge`] declares an edge
//! that points **into** the processed node:
//!   - [`EdgeFrom::UserAnchor`] → `(:UserProfile)-[rel]->(:ThisEntity)`
//!   - [`EdgeFrom::PayloadFk`]  → `(:OtherEntity {id=fk})-[rel]->(:ThisEntity)`
//!
//! ## Tenant safety
//! Every edge's target node is MERGEd under the *same* `tenant_id` as the source
//! (see `merge_cypher_for`), so the registry can never produce a cross-tenant edge.
//! The FK id is read from the same row's payload, i.e. the same owner.

use crate::entities::EntityType;

/// The tenant's root anchor node label (entity_type string form).
pub const USER_PROFILE: &str = "user_profile";

/// Domain ownership of a node label / relationship. Used for documentation,
/// quality gates, and future per-domain enable flags.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Domain {
    Root,
    Finance,
    Health,
    Career,
    Family,
    Education,
    Decision,
    General,
}

/// Where the *source* end of an incoming edge comes from.
#[derive(Clone, Copy, Debug)]
pub enum EdgeFrom {
    /// Source is the tenant's `UserProfile` (id == user_id). Always available.
    UserAnchor,
    /// Source is another entity whose id is read from a payload foreign-key field.
    /// The edge is emitted only when the field is present and non-empty — never a
    /// fabricated link.
    PayloadFk {
        /// entity_type (snake) of the source node, e.g. `"financial_account"`.
        from_label: &'static str,
        /// payload field holding the source id, e.g. `"account_id"`.
        field: &'static str,
    },
}

/// One declared edge pointing into a processed node.
#[derive(Clone, Copy, Debug)]
pub struct IncomingEdge {
    pub rel_type: &'static str,
    pub from: EdgeFrom,
    /// `UserAnchor` edges are structurally required; `PayloadFk` edges are optional
    /// (emitted only when the FK exists). Used by the quality gates / tests.
    pub required: bool,
    pub version: u32,
}

const fn user(rel: &'static str) -> IncomingEdge {
    IncomingEdge {
        rel_type: rel,
        from: EdgeFrom::UserAnchor,
        required: true,
        version: 1,
    }
}
const fn fk(rel: &'static str, from_label: &'static str, field: &'static str) -> IncomingEdge {
    IncomingEdge {
        rel_type: rel,
        from: EdgeFrom::PayloadFk { from_label, field },
        required: false,
        version: 1,
    }
}

// ── Finance ontology (live; the reference implementation) ───────────────────
// Each list = the typed edges that point into a node of this entity type. Only
// edges whose source data exists today are declared; future links are documented
// extension points in LIFENAVIGATOR_ONTOLOGY_STANDARD.md, NOT fake edges here.

const FINANCIAL_ACCOUNT: &[IncomingEdge] = &[user("OWNS_ACCOUNT")];
const TRANSACTION_SUMMARY: &[IncomingEdge] = &[
    user("HAS_TRANSACTION"),
    fk("HAS_TRANSACTION", "financial_account", "account_id"),
];
const ASSET: &[IncomingEdge] = &[user("HAS_ASSET")];
const DEBT: &[IncomingEdge] = &[user("HAS_DEBT")];
const INVESTMENT_HOLDING: &[IncomingEdge] = &[
    user("HAS_HOLDING"),
    fk("HAS_HOLDING", "financial_account", "account_id"),
];
const RETIREMENT_PLAN: &[IncomingEdge] = &[user("CONTRIBUTES_TO")];
const FINANCIAL_GOAL: &[IncomingEdge] = &[user("HAS_GOAL")];

// ── Finance elite schema (migration 117) — user-ownership edges ──────────────
const LIABILITY: &[IncomingEdge] = &[user("HAS_LIABILITY")];
const CASH_FLOW_SNAPSHOT: &[IncomingEdge] = &[user("HAS_SNAPSHOT")];
const NET_WORTH_SNAPSHOT: &[IncomingEdge] = &[user("HAS_SNAPSHOT")];
const BUDGET_CATEGORY: &[IncomingEdge] = &[user("HAS_BUDGET_CATEGORY")];
const INCOME_SOURCE: &[IncomingEdge] = &[user("HAS_INCOME_SOURCE")];
const EXPENSE_CATEGORY: &[IncomingEdge] = &[user("HAS_EXPENSE_CATEGORY")];
const FINANCIAL_EVENT: &[IncomingEdge] = &[user("LOGGED")];

// ── Recommendation evidence graph (RECOMMENDATION_EVIDENCE_GRAPH_SPEC.md) ────
// The recommendation is user-anchored; evidence/assumption/tradeoff/advice-boundary
// nodes anchor to the recommendation via a `recommendation_id` FK (so traversal is
// user -> recommendation -> evidence). ADDRESSES (rec -> goal/debt/budget) and
// GOVERNED_BY (rec -> governance_rule) are EXTENSION POINTS: the recommendation is
// the edge SOURCE, which needs outgoing-edge support in merge_cypher_for — tracked,
// not faked here.
const FINANCIAL_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];
const EVIDENCE: &[IncomingEdge] = &[fk(
    "HAS_EVIDENCE",
    "financial_recommendation",
    "recommendation_id",
)];
const ASSUMPTION: &[IncomingEdge] = &[fk(
    "HAS_ASSUMPTION",
    "financial_recommendation",
    "recommendation_id",
)];
const TRADEOFF: &[IncomingEdge] = &[fk(
    "HAS_TRADEOFF",
    "financial_recommendation",
    "recommendation_id",
)];
const ADVICE_BOUNDARY: &[IncomingEdge] = &[fk(
    "REQUIRES_REVIEW",
    "financial_recommendation",
    "recommendation_id",
)];

// ── Health & Wellness (H1; migration 119) — user-anchor edges ────────────────
// Benefit inter-entity edges (HealthInsurancePlan COVERED_BY EmployerBenefit;
// MedicalExpense ELIGIBLE_FOR_HSA_FSA HealthSpendingAccount; BenefitDeadline
// ADDRESSES HealthSpendingAccount) have the processed node as the edge SOURCE, so
// they need outgoing-edge support in merge_cypher_for — EXTENSION POINTS, not faked.
const HEALTH_PROFILE: &[IncomingEdge] = &[user("HAS_WELLNESS")];
const HEALTH_GOAL: &[IncomingEdge] = &[user("HAS_HEALTH_GOAL")];
const WELLNESS_HABIT: &[IncomingEdge] = &[user("PURSUING")];
const ACTIVITY_LOG: &[IncomingEdge] = &[user("LOGGED")];
const SLEEP_LOG: &[IncomingEdge] = &[user("LOGGED")];
const NUTRITION_LOG: &[IncomingEdge] = &[user("LOGGED")];
const SUPPLEMENT_LOG: &[IncomingEdge] = &[user("LOGGED")];
const WORKOUT_LOG: &[IncomingEdge] = &[user("LOGGED")];
const VITAL: &[IncomingEdge] = &[user("TRACKS_METRIC")];
const LAB_MARKER: &[IncomingEdge] = &[user("TRACKS_METRIC")];
const BODY_METRIC: &[IncomingEdge] = &[user("TRACKS_METRIC")];
const HEALTH_INSURANCE_PLAN: &[IncomingEdge] = &[user("HAS_INSURANCE_PLAN")];
const HEALTH_SPENDING_ACCOUNT: &[IncomingEdge] = &[user("HAS_SPENDING_ACCOUNT")];
const MEDICAL_EXPENSE: &[IncomingEdge] = &[user("LOGGED")];
const BENEFIT_DEADLINE: &[IncomingEdge] = &[user("HAS_BENEFIT_DEADLINE")];
const HEALTH_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];

// ── Career ontology (migration 122) ─────────────────────────────────────────
// Every Career entity is user-anchored (required) so none falls back to RELATED_TO.
// Inter-entity FK edges are declared ONLY where the X1 schema FK exists and reads
// naturally as (:Source)-[rel]->(:Processed). Reverse-direction links (CareerGoal→
// JobTarget, JobTarget→Skill, QUALIFIES_FOR, cross-domain IMPACTS/AFFECTS_CASHFLOW/
// SUPPORTS_GOAL) are documented extension points in CAREER_EDUCATION_FAMILY_ONTOLOGY —
// NOT faked here (no FK / outgoing-edge support yet).
const CAREER_PROFILE: &[IncomingEdge] = &[user("HAS_CAREER")];
const CAREER_GOAL: &[IncomingEdge] = &[user("HAS_GOAL")];
const EXPERIENCE_RECORD: &[IncomingEdge] = &[user("HAS_EXPERIENCE")];
const SKILL: &[IncomingEdge] = &[user("HAS_SKILL")];
const USER_SKILL: &[IncomingEdge] = &[
    user("HAS_SKILL"),
    fk("HAS_PROFICIENCY", "skill", "skill_id"),
];
const SKILL_GAP: &[IncomingEdge] = &[user("HAS_SKILL_GAP")];
const CREDENTIAL: &[IncomingEdge] = &[user("HAS_CREDENTIAL")];
const CERTIFICATION: &[IncomingEdge] = &[user("HAS_CERTIFICATION")];
const DEGREE: &[IncomingEdge] = &[user("HAS_DEGREE")];
const RESUME: &[IncomingEdge] = &[user("HAS_RESUME")];
const PORTFOLIO_ITEM: &[IncomingEdge] = &[user("HAS_PORTFOLIO_ITEM")];
const JOB_TARGET: &[IncomingEdge] = &[user("TARGETS_ROLE")];
const JOB_APPLICATION: &[IncomingEdge] = &[user("HAS_APPLICATION")];
const INTERVIEW: &[IncomingEdge] = &[
    user("HAS_INTERVIEW"),
    fk(
        "INCLUDES_INTERVIEW",
        "job_application",
        "job_application_id",
    ),
];
const COMPENSATION_RECORD: &[IncomingEdge] = &[user("HAS_COMPENSATION")];
const COMPENSATION_PROJECTION: &[IncomingEdge] = &[user("HAS_COMPENSATION_PROJECTION")];
const CAREER_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];

/// Registry lookup: the declared incoming edges for an entity type.
///
/// Returns a non-empty slice for entities the ontology registry owns (finance
/// today). An empty slice means "not registry-mapped" — the normalizer then uses
/// its legacy typed-label `match`, and unmapped types fall back to `RELATED_TO`.
/// Mapped entities therefore NEVER fall back to `RELATED_TO`.
pub fn incoming_edges(et: &EntityType) -> &'static [IncomingEdge] {
    match et {
        EntityType::FinancialAccount => FINANCIAL_ACCOUNT,
        EntityType::TransactionSummary => TRANSACTION_SUMMARY,
        EntityType::Asset => ASSET,
        EntityType::Debt => DEBT,
        EntityType::InvestmentHolding => INVESTMENT_HOLDING,
        EntityType::RetirementPlan => RETIREMENT_PLAN,
        EntityType::FinancialGoal => FINANCIAL_GOAL,
        // Finance elite schema (migration 117).
        EntityType::Liability => LIABILITY,
        EntityType::CashFlowSnapshot => CASH_FLOW_SNAPSHOT,
        EntityType::NetWorthSnapshot => NET_WORTH_SNAPSHOT,
        EntityType::BudgetCategory => BUDGET_CATEGORY,
        EntityType::IncomeSource => INCOME_SOURCE,
        EntityType::ExpenseCategory => EXPENSE_CATEGORY,
        EntityType::FinancialEvent => FINANCIAL_EVENT,
        // Recommendation evidence graph.
        EntityType::FinancialRecommendation => FINANCIAL_RECOMMENDATION,
        EntityType::Evidence => EVIDENCE,
        EntityType::Assumption => ASSUMPTION,
        EntityType::Tradeoff => TRADEOFF,
        EntityType::AdviceBoundary => ADVICE_BOUNDARY,
        // Health & Wellness (migration 119).
        EntityType::HealthProfile => HEALTH_PROFILE,
        EntityType::HealthGoal => HEALTH_GOAL,
        EntityType::WellnessHabit => WELLNESS_HABIT,
        EntityType::ActivityLog => ACTIVITY_LOG,
        EntityType::SleepLog => SLEEP_LOG,
        EntityType::NutritionLog => NUTRITION_LOG,
        EntityType::SupplementLog => SUPPLEMENT_LOG,
        EntityType::WorkoutLog => WORKOUT_LOG,
        EntityType::Vital => VITAL,
        EntityType::LabMarker => LAB_MARKER,
        EntityType::BodyMetric => BODY_METRIC,
        EntityType::HealthInsurancePlan => HEALTH_INSURANCE_PLAN,
        EntityType::HealthSpendingAccount => HEALTH_SPENDING_ACCOUNT,
        EntityType::MedicalExpense => MEDICAL_EXPENSE,
        EntityType::BenefitDeadline => BENEFIT_DEADLINE,
        EntityType::HealthRecommendation => HEALTH_RECOMMENDATION,
        // Career (migration 122).
        EntityType::CareerProfile => CAREER_PROFILE,
        EntityType::CareerGoal => CAREER_GOAL,
        EntityType::ExperienceRecord => EXPERIENCE_RECORD,
        EntityType::Skill => SKILL,
        EntityType::UserSkill => USER_SKILL,
        EntityType::SkillGap => SKILL_GAP,
        EntityType::Credential => CREDENTIAL,
        EntityType::Certification => CERTIFICATION,
        EntityType::Degree => DEGREE,
        EntityType::Resume => RESUME,
        EntityType::PortfolioItem => PORTFOLIO_ITEM,
        EntityType::JobTarget => JOB_TARGET,
        EntityType::JobApplication => JOB_APPLICATION,
        EntityType::Interview => INTERVIEW,
        EntityType::CompensationRecord => COMPENSATION_RECORD,
        EntityType::CompensationProjection => COMPENSATION_PROJECTION,
        EntityType::CareerRecommendation => CAREER_RECOMMENDATION,
        _ => &[],
    }
}

/// Whether the ontology registry owns this entity's relationship emission.
pub fn is_registry_mapped(et: &EntityType) -> bool {
    !incoming_edges(et).is_empty()
}

/// Domain ownership for an entity type (documentation + quality gates).
pub fn domain_of(et: &EntityType) -> Domain {
    match et {
        EntityType::UserProfile | EntityType::PersonaProfile => Domain::Root,
        EntityType::FinancialAccount
        | EntityType::TransactionSummary
        | EntityType::Asset
        | EntityType::Debt
        | EntityType::InvestmentHolding
        | EntityType::RetirementPlan
        | EntityType::FinancialGoal
        | EntityType::TaxProfile
        | EntityType::UserFinancialProfile
        | EntityType::FinancialRecommendation
        | EntityType::Liability
        | EntityType::CashFlowSnapshot
        | EntityType::NetWorthSnapshot
        | EntityType::BudgetCategory
        | EntityType::IncomeSource
        | EntityType::ExpenseCategory
        | EntityType::FinancialEvent
        | EntityType::Evidence
        | EntityType::Assumption
        | EntityType::Tradeoff
        | EntityType::AdviceBoundary => Domain::Finance,
        EntityType::HealthProfile
        | EntityType::HealthGoal
        | EntityType::WellnessHabit
        | EntityType::ActivityLog
        | EntityType::SleepLog
        | EntityType::NutritionLog
        | EntityType::SupplementLog
        | EntityType::WorkoutLog
        | EntityType::Vital
        | EntityType::LabMarker
        | EntityType::BodyMetric
        | EntityType::HealthInsurancePlan
        | EntityType::HealthSpendingAccount
        | EntityType::MedicalExpense
        | EntityType::BenefitDeadline
        | EntityType::HealthRecommendation => Domain::Health,
        EntityType::CareerProfile
        | EntityType::CareerGoal
        | EntityType::ExperienceRecord
        | EntityType::Skill
        | EntityType::UserSkill
        | EntityType::SkillGap
        | EntityType::Credential
        | EntityType::Certification
        | EntityType::Degree
        | EntityType::Resume
        | EntityType::PortfolioItem
        | EntityType::JobTarget
        | EntityType::JobApplication
        | EntityType::Interview
        | EntityType::CompensationRecord
        | EntityType::CompensationProjection
        | EntityType::CareerRecommendation => Domain::Career,
        _ => Domain::General,
    }
}

#[cfg(test)]
mod career_tests {
    use super::*;

    /// Every mapped Career entity has at least one incoming edge → it can NEVER
    /// fall back to RELATED_TO.
    #[test]
    fn all_career_entities_registry_mapped() {
        for et in [
            EntityType::CareerProfile,
            EntityType::CareerGoal,
            EntityType::ExperienceRecord,
            EntityType::Skill,
            EntityType::UserSkill,
            EntityType::SkillGap,
            EntityType::Credential,
            EntityType::Certification,
            EntityType::Degree,
            EntityType::Resume,
            EntityType::PortfolioItem,
            EntityType::JobTarget,
            EntityType::JobApplication,
            EntityType::Interview,
            EntityType::CompensationRecord,
            EntityType::CompensationProjection,
            EntityType::CareerRecommendation,
        ] {
            assert!(
                is_registry_mapped(&et),
                "{et:?} not registry-mapped (would RELATED_TO)"
            );
            assert_eq!(domain_of(&et), Domain::Career, "{et:?} wrong domain_of");
        }
    }

    #[test]
    fn career_user_anchor_edges_are_typed_and_required() {
        let cases = [
            (EntityType::CareerProfile, "HAS_CAREER"),
            (EntityType::CareerGoal, "HAS_GOAL"),
            (EntityType::ExperienceRecord, "HAS_EXPERIENCE"),
            (EntityType::UserSkill, "HAS_SKILL"),
            (EntityType::JobTarget, "TARGETS_ROLE"),
            (EntityType::CompensationRecord, "HAS_COMPENSATION"),
            (
                EntityType::CompensationProjection,
                "HAS_COMPENSATION_PROJECTION",
            ),
            (EntityType::CareerRecommendation, "HAS_RECOMMENDATION"),
        ];
        for (et, rel) in cases {
            let edges = incoming_edges(&et);
            let anchor = edges
                .iter()
                .find(|e| matches!(e.from, EdgeFrom::UserAnchor))
                .expect("user anchor");
            assert_eq!(anchor.rel_type, rel, "{et:?}");
            assert!(anchor.required, "{et:?} user anchor must be required");
            assert!(edges.iter().all(|e| e.rel_type != "RELATED_TO"));
        }
    }

    /// Optional inter-entity FK edges are declared ONLY where the X1 FK exists,
    /// and they are optional (not required).
    #[test]
    fn career_optional_fk_edges() {
        let us: Vec<_> = incoming_edges(&EntityType::UserSkill)
            .iter()
            .filter(|e| matches!(e.from, EdgeFrom::PayloadFk { .. }))
            .collect();
        assert!(us
            .iter()
            .any(|e| e.rel_type == "HAS_PROFICIENCY" && !e.required));
        let iv: Vec<_> = incoming_edges(&EntityType::Interview).iter()
            .filter(|e| matches!(e.from, EdgeFrom::PayloadFk { field, .. } if field == "job_application_id")).collect();
        assert!(iv
            .iter()
            .any(|e| e.rel_type == "INCLUDES_INTERVIEW" && !e.required));
        // entities with no FK in the X1 schema declare ONLY the user anchor (no faked FK).
        assert!(incoming_edges(&EntityType::CareerGoal)
            .iter()
            .all(|e| matches!(e.from, EdgeFrom::UserAnchor)));
    }
}
