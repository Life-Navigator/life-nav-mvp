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

    // ---- Health & Wellness (H1; migration 119) ----
    #[test]
    fn health_entities_user_anchored_no_fallback() {
        for (et, rel) in [
            (EntityType::HealthProfile, "HAS_WELLNESS"),
            (EntityType::HealthGoal, "HAS_HEALTH_GOAL"),
            (EntityType::WellnessHabit, "PURSUING"),
            (EntityType::SleepLog, "LOGGED"),
            (EntityType::ActivityLog, "LOGGED"),
            (EntityType::NutritionLog, "LOGGED"),
            (EntityType::SupplementLog, "LOGGED"),
            (EntityType::WorkoutLog, "LOGGED"),
            (EntityType::Vital, "TRACKS_METRIC"),
            (EntityType::LabMarker, "TRACKS_METRIC"),
            (EntityType::BodyMetric, "TRACKS_METRIC"),
            (EntityType::HealthInsurancePlan, "HAS_INSURANCE_PLAN"),
            (EntityType::HealthSpendingAccount, "HAS_SPENDING_ACCOUNT"),
            (EntityType::MedicalExpense, "LOGGED"),
            (EntityType::BenefitDeadline, "HAS_BENEFIT_DEADLINE"),
            (EntityType::HealthRecommendation, "HAS_RECOMMENDATION"),
        ] {
            let r = registry_relationships(&et, "u1", &attrs(json!({}))).unwrap();
            assert!(has(&r, rel, "user_profile"), "{et:?} missing {rel}");
            assert!(
                !r.iter().any(|x| x.label == "RELATED_TO"),
                "{et:?} RELATED_TO"
            );
        }
    }
}

#[cfg(test)]
mod transaction_granularity_tests {
    //! Investigation C — does the worker aggregate transactions?
    //!
    //! `TransactionSummary` is NAMED a summary, but `entities.rs:57-61` documents that
    //! `finance.transactions` emits `entity_type='transaction'` (aliased in). This fixture measures
    //! what the worker actually produces for several transactions on ONE account across TWO periods.
    //!
    //! Result: the worker performs NO period bucketing, NO account grouping, NO aggregation, and NO
    //! consolidation. Each source record yields its own node and its own edge pair. Granularity is
    //! therefore decided ENTIRELY upstream, by whatever `finance.transactions` emits — not here.
    use crate::entities::EntityType;
    use crate::relationships::registry_relationships;
    use serde_json::json;

    fn attrs(v: serde_json::Value) -> serde_json::Map<String, serde_json::Value> {
        v.as_object().unwrap().clone()
    }

    fn txn(account: &str, period: &str) -> Vec<crate::entities::Relationship> {
        registry_relationships(
            &EntityType::TransactionSummary,
            "user-1",
            &attrs(json!({ "account_id": account, "period": period })),
        )
        .unwrap()
    }

    #[test]
    fn each_transaction_record_emits_its_own_edge_pair_no_aggregation() {
        // Same account, two periods, three records.
        let a = txn("acct-1", "2026-06");
        let b = txn("acct-1", "2026-06");   // same account AND same period
        let c = txn("acct-1", "2026-07");

        // Two edges per record: user-anchored + account-anchored (ontology.rs:93-96).
        for (name, r) in [("a", &a), ("b", &b), ("c", &c)] {
            assert_eq!(r.len(), 2, "{name}: expected 2 edges per record, got {}", r.len());
            assert!(r.iter().any(|x| x.label == "HAS_TRANSACTION"
                && x.target_entity_type == "user_profile"));
            assert!(r.iter().any(|x| x.label == "HAS_TRANSACTION"
                && x.target_entity_type == "financial_account"));
        }

        // Two records in the SAME account+period produce identical edge shape — the worker does not
        // consolidate them. Node identity comes from the inherited entity_id, so two source rows =
        // two nodes. Growth is therefore PER SOURCE RECORD.
        assert_eq!(a.len(), b.len());
        assert_eq!(
            a.iter().map(|x| x.label.as_str()).collect::<Vec<_>>(),
            b.iter().map(|x| x.label.as_str()).collect::<Vec<_>>(),
            "same account+period yields the same edges — no period bucketing exists"
        );

        // Total for 3 records on 1 account = 6 edges. If the worker bucketed by account-period we
        // would expect 2 nodes (2 periods) and 4 edges.
        let total: usize = a.len() + b.len() + c.len();
        assert_eq!(total, 6, "3 records -> 6 edges: confirms no aggregation");
    }

    #[test]
    fn account_fk_absent_means_only_the_user_edge_is_emitted() {
        // Documents the fallback: without account_id there is no inter-entity edge, so the
        // user-anchored edge is the ONLY path to the node. Relevant to ADR-001, which proposes
        // removing that edge: records lacking account_id would become unreachable by traversal.
        let r = registry_relationships(
            &EntityType::TransactionSummary,
            "user-1",
            &attrs(json!({})),
        )
        .unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].target_entity_type, "user_profile");
    }
}
