//! Registry-driven relationship emission. Translates the declarative
//! [`crate::ontology`] rules into the concrete [`Relationship`] list the Neo4j
//! upsert consumes. This is the seam future domains extend: add rules to
//! `ontology::incoming_edges`, not control flow here.

use serde_json::{Map, Value};

use crate::entities::Relationship;
use crate::ontology::{self, EdgeFrom};

/// Build the typed relationships for a registry-mapped entity.
///
/// Returns `Some(edges)` when the ontology registry owns this entity type
/// (finance today), or `None` when it does not — in which case the normalizer
/// falls back to its legacy typed-label `match` (and unmapped types to
/// `RELATED_TO`). A registry-mapped entity therefore never falls back.
///
/// `attrs` is the *sanitized* payload; FK-sourced edges are emitted only when the
/// field is present and non-empty. The FK id belongs to the same owner's row, so
/// the resulting edge is always tenant-safe.
pub fn registry_relationships(
    et: &crate::entities::EntityType,
    user_id: &str,
    attrs: &Map<String, Value>,
) -> Option<Vec<Relationship>> {
    if user_id.is_empty() {
        return Some(Vec::new());
    }
    let rules = ontology::incoming_edges(et);
    if rules.is_empty() {
        return None;
    }
    let mut out = Vec::with_capacity(rules.len());
    for rule in rules {
        match rule.from {
            EdgeFrom::UserAnchor => out.push(Relationship {
                label: rule.rel_type.into(),
                target_entity_type: ontology::USER_PROFILE.into(),
                target_entity_id: user_id.to_string(),
            }),
            EdgeFrom::PayloadFk { from_label, field } => {
                if let Some(id) = attrs
                    .get(field)
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .filter(|s| !s.is_empty())
                {
                    out.push(Relationship {
                        label: rule.rel_type.into(),
                        target_entity_type: from_label.into(),
                        target_entity_id: id,
                    });
                }
            }
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::EntityType;
    use serde_json::json;

    fn attrs(v: Value) -> Map<String, Value> {
        v.as_object().cloned().unwrap_or_default()
    }
    fn has(rels: &[Relationship], label: &str, target: &str) -> bool {
        rels.iter()
            .any(|r| r.label == label && r.target_entity_type == target)
    }

    #[test]
    fn finance_account_is_registry_mapped_and_emits_owns_account() {
        let r =
            registry_relationships(&EntityType::FinancialAccount, "u1", &attrs(json!({}))).unwrap();
        assert!(has(&r, "OWNS_ACCOUNT", "user_profile"));
        assert!(!has(&r, "RELATED_TO", "user_profile"));
    }

    #[test]
    fn transaction_emits_user_and_account_edges_from_fk() {
        let r = registry_relationships(
            &EntityType::TransactionSummary,
            "u1",
            &attrs(json!({"account_id": "acc-9"})),
        )
        .unwrap();
        assert!(has(&r, "HAS_TRANSACTION", "user_profile"));
        assert!(r.iter().any(|x| x.label == "HAS_TRANSACTION"
            && x.target_entity_type == "financial_account"
            && x.target_entity_id == "acc-9"));
    }

    #[test]
    fn fk_edge_omitted_when_field_absent() {
        let r = registry_relationships(&EntityType::TransactionSummary, "u1", &attrs(json!({})))
            .unwrap();
        assert!(has(&r, "HAS_TRANSACTION", "user_profile"));
        assert!(!has(&r, "HAS_TRANSACTION", "financial_account"));
    }

    #[test]
    fn unmapped_entity_returns_none_for_legacy_fallback() {
        assert!(
            registry_relationships(&EntityType::HealthMetric, "u1", &attrs(json!({}))).is_none()
        );
        assert!(registry_relationships(&EntityType::Unknown, "u1", &attrs(json!({}))).is_none());
    }

    #[test]
    fn empty_user_id_yields_no_edges() {
        let r =
            registry_relationships(&EntityType::FinancialAccount, "", &attrs(json!({}))).unwrap();
        assert!(r.is_empty());
    }

    /// Ontology invariant: every mapped finance entity is registry-owned, has a
    /// required UserAnchor edge, and NEVER emits the generic RELATED_TO fallback.
    #[test]
    fn all_finance_entities_mapped_with_required_user_edge_and_no_fallback() {
        let finance = [
            EntityType::FinancialAccount,
            EntityType::TransactionSummary,
            EntityType::Asset,
            EntityType::Debt,
            EntityType::InvestmentHolding,
            EntityType::RetirementPlan,
            EntityType::FinancialGoal,
        ];
        for et in finance {
            assert!(
                ontology::is_registry_mapped(&et),
                "{et:?} not registry-mapped"
            );
            let edges = ontology::incoming_edges(&et);
            assert!(
                edges
                    .iter()
                    .any(|e| e.required && matches!(e.from, EdgeFrom::UserAnchor)),
                "{et:?} missing required UserAnchor edge"
            );
            let rels =
                registry_relationships(&et, "u1", &attrs(json!({"account_id": "x"}))).unwrap();
            assert!(!rels.is_empty(), "{et:?} emitted no edges");
            assert!(
                !rels.iter().any(|r| r.label == "RELATED_TO"),
                "{et:?} emitted RELATED_TO"
            );
            // tenant-safe: every edge targets the user or a same-row FK, never a
            // literal cross-tenant id.
            assert!(rels.iter().all(|r| !r.target_entity_id.is_empty()));
        }
    }

    // ---- Finance elite schema + recommendation evidence graph (migration 117) ----

    #[test]
    fn financial_recommendation_emits_user_anchor_not_fallback() {
        let r = registry_relationships(
            &EntityType::FinancialRecommendation,
            "u1",
            &attrs(json!({})),
        )
        .unwrap();
        assert!(has(&r, "HAS_RECOMMENDATION", "user_profile"));
        assert!(!has(&r, "RELATED_TO", "user_profile"));
    }

    #[test]
    fn evidence_graph_anchors_to_recommendation_via_fk() {
        for (et, rel) in [
            (EntityType::Evidence, "HAS_EVIDENCE"),
            (EntityType::Assumption, "HAS_ASSUMPTION"),
            (EntityType::Tradeoff, "HAS_TRADEOFF"),
            (EntityType::AdviceBoundary, "REQUIRES_REVIEW"),
        ] {
            let r =
                registry_relationships(&et, "u1", &attrs(json!({"recommendation_id": "rec-1"})))
                    .unwrap();
            assert!(
                r.iter().any(|x| x.label == rel
                    && x.target_entity_type == "financial_recommendation"
                    && x.target_entity_id == "rec-1"),
                "{et:?} missing {rel} -> financial_recommendation"
            );
            assert!(
                !r.iter().any(|x| x.label == "RELATED_TO"),
                "{et:?} fell back to RELATED_TO"
            );
        }
    }

    #[test]
    fn evidence_without_recommendation_id_has_no_fallback_edge() {
        // mapped entity: no RELATED_TO fallback; FK absent -> simply no edge.
        let r = registry_relationships(&EntityType::Evidence, "u1", &attrs(json!({}))).unwrap();
        assert!(r.is_empty());
    }

    #[test]
    fn finance_elite_tables_have_user_anchor_no_fallback() {
        for et in [
            EntityType::Liability,
            EntityType::CashFlowSnapshot,
            EntityType::NetWorthSnapshot,
            EntityType::BudgetCategory,
            EntityType::IncomeSource,
            EntityType::ExpenseCategory,
            EntityType::FinancialEvent,
        ] {
            let r = registry_relationships(&et, "u1", &attrs(json!({}))).unwrap();
            assert!(!r.is_empty(), "{et:?} emitted no edges");
            assert_eq!(
                r[0].target_entity_type, "user_profile",
                "{et:?} not user-anchored"
            );
            assert!(
                !r.iter().any(|x| x.label == "RELATED_TO"),
                "{et:?} fell back to RELATED_TO"
            );
        }
    }
}
