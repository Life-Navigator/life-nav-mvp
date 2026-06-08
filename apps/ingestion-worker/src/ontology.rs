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
        | EntityType::UserFinancialProfile => Domain::Finance,
        _ => Domain::General,
    }
}
