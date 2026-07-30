//! The canonical domain vocabulary — one source of truth for the `domain` property written onto every
//! graph node and vector payload, and read back by retrieval filters.
//!
//! ## The defect this exists to prevent
//!
//! The ingestion worker writes `domain: "financial"`. The core-api query planner emitted `"finance"`.
//! Nothing reconciled the two, so the retrieval filter
//! `{"key": "domain", "match": {"value": "finance"}}` matched **zero** of the 1,583 financial points in
//! production. Measured against the live collection, same tenant, same vector:
//!
//! | filter | hits |
//! |---|---|
//! | `domain=finance` (what the code sent) | 0 |
//! | `domain=financial` (what the data holds) | 5 |
//! | no domain filter | 5 |
//!
//! Zero vector seeds means no traversal seeds, which means the graph contributes nothing — and the
//! trace reports `vector_seeds: 0`, indistinguishable from "this user has no data". The same mismatch
//! silently disabled the domain-alignment boost in fusion ranking.
//!
//! The value is `financial` because that is what 1,583 live points and the entire graph already carry.
//! Canonicalising on `finance` instead would have required re-embedding the corpus to fix a naming
//! disagreement — a cost with no retrieval benefit.
//!
//! ## Scope — three different things are called "finance" in this repo
//!
//! 1. **The graph/vector `domain` property.** This module. Canonical value: `financial`.
//! 2. **The Postgres schema `finance`.** A database schema name (`.schema("finance")`, 57 call sites).
//!    NOT a domain value and NOT renamed by anything here.
//! 3. **The `/v1/finance` API route and the `domains::registry` module key.** A public API surface with
//!    its own compatibility obligations. Unaffected.
//!
//! Conflating these would break the application. Only (1) is in scope.

/// Every domain value `EntityType::domain()` can return.
///
/// `domain_values_are_canonical` walks every entity type reachable from the ontology registry and the
/// legacy edge table and asserts its domain appears here, so a new domain string cannot enter the graph
/// without being declared.
pub const CANONICAL_DOMAINS: &[&str] = &[
    "arcana",
    "attribution",
    "calibration",
    "career",
    "conversation",
    "decision",
    "decision_impact",
    "documents",
    "education",
    "estate",
    "family",
    "financial",
    "general",
    "goal_progress",
    "goals",
    "health",
    "insurance",
    "jobs",
    "lifestyle",
    "probability",
    "provider",
    "xai",
];

/// Deprecated spellings accepted at boundaries and rewritten to canonical form.
///
/// This table is a MIGRATION AID with an exit condition, not a permanent compatibility layer. See
/// `DOMAIN_VOCABULARY_CONTRACT.md` for the removal criteria.
pub const DOMAIN_ALIASES: &[(&str, &str)] = &[
    // The core-api planner's spelling. The only alias that has ever caused a production defect.
    ("finance", "financial"),
];

/// Rewrite a domain value to canonical form.
///
/// Returns `None` for an unknown value — callers must decide loudly rather than silently filtering on a
/// string no writer ever produces, which is exactly how the original defect stayed invisible.
pub fn normalize_domain(raw: &str) -> Option<&'static str> {
    let lowered = raw.trim().to_ascii_lowercase();
    if let Some((_, canon)) = DOMAIN_ALIASES.iter().find(|(alias, _)| *alias == lowered) {
        return Some(canon);
    }
    CANONICAL_DOMAINS.iter().find(|d| **d == lowered).copied()
}

/// Whether a value is already canonical.
pub fn is_canonical(raw: &str) -> bool {
    CANONICAL_DOMAINS.contains(&raw)
}

/// The exported domain contract, as JSON — the counterpart to the relationship manifest.
///
/// Written to `apps/lifenavigator-core-api/app/grounding/semantic/domain_manifest.json` and loaded by
/// the Python normalizer, so both tiers share one vocabulary instead of two hand-maintained lists.
pub fn domain_manifest() -> String {
    let canon = CANONICAL_DOMAINS
        .iter()
        .map(|d| format!("    \"{d}\""))
        .collect::<Vec<_>>()
        .join(",\n");
    let aliases = DOMAIN_ALIASES
        .iter()
        .map(|(a, c)| format!("    \"{a}\": \"{c}\""))
        .collect::<Vec<_>>()
        .join(",\n");
    format!(
        "{{\n  \"_generated_by\": \"apps/ingestion-worker/src/domain_vocabulary.rs :: domain_manifest()\",\n  \
\"_do_not_edit\": \"Regenerate with: cargo test -p ingestion-worker export_domain_manifest -- --ignored\",\n  \
\"version\": 1,\n  \"canonical\": [\n{canon}\n  ],\n  \"aliases\": {{\n{aliases}\n  }}\n}}\n"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::EntityType;
    use crate::ontology::{LEGACY_USER_EDGES, REGISTRY};

    /// No entity may write a domain value that is not declared canonical.
    #[test]
    fn domain_values_are_canonical() {
        let mut offenders: Vec<(String, &str)> = Vec::new();
        let types: Vec<&EntityType> = REGISTRY
            .iter()
            .map(|(et, _)| et)
            .chain(LEGACY_USER_EDGES.iter().map(|(et, _)| et))
            .collect();
        for et in types {
            let d = et.domain();
            if !is_canonical(d) {
                offenders.push((format!("{et:?}"), d));
            }
        }
        assert!(
            offenders.is_empty(),
            "entity types write non-canonical domain values: {offenders:?}\n\n\
             Add the value to CANONICAL_DOMAINS (and regenerate the domain manifest), or change the \
             writer. An undeclared domain cannot be filtered on by retrieval.",
        );
    }

    /// POSITIVE CONTROL: the planner's spelling reaches the stored spelling.
    #[test]
    fn finance_alias_normalizes_to_financial() {
        assert_eq!(normalize_domain("finance"), Some("financial"));
        assert_eq!(normalize_domain("Finance"), Some("financial"));
        assert_eq!(normalize_domain("  FINANCE "), Some("financial"));
    }

    /// Canonical values survive normalization unchanged (idempotence).
    #[test]
    fn canonical_values_are_stable() {
        for d in CANONICAL_DOMAINS {
            assert_eq!(normalize_domain(d), Some(*d), "{d} did not round-trip");
        }
    }

    /// Unknown domains fail visibly rather than being passed through as a filter that matches nothing.
    #[test]
    fn unknown_domain_is_rejected() {
        assert_eq!(normalize_domain("cryptocurrency"), None);
        assert_eq!(normalize_domain(""), None);
    }

    /// An alias must never also be a canonical value — that would make normalization ambiguous.
    #[test]
    fn aliases_are_not_canonical_values() {
        for (alias, canon) in DOMAIN_ALIASES {
            assert!(
                !CANONICAL_DOMAINS.contains(alias),
                "{alias} is both an alias and a canonical value"
            );
            assert!(
                CANONICAL_DOMAINS.contains(canon),
                "alias {alias} points at {canon}, which is not canonical"
            );
        }
    }

    #[test]
    #[ignore = "regenerates the domain manifest; run explicitly"]
    fn export_domain_manifest() {
        let path = "../lifenavigator-core-api/app/grounding/semantic/domain_manifest.json";
        std::fs::write(path, domain_manifest()).expect("write domain manifest");
        println!("wrote {} canonical domains -> {path}", CANONICAL_DOMAINS.len());
    }

    #[test]
    fn manifest_on_disk_matches_the_vocabulary() {
        let path = "../lifenavigator-core-api/app/grounding/semantic/domain_manifest.json";
        let on_disk = std::fs::read_to_string(path).expect(
            "domain manifest missing. Regenerate: \
             cargo test -p ingestion-worker export_domain_manifest -- --ignored",
        );
        // Compare CONTENT, not bytes: formatting differences must not fail the gate.
        let parse = |s: &str| -> (Vec<String>, Vec<(String, String)>) {
            let v: serde_json::Value = serde_json::from_str(s).expect("valid json");
            let canon = v["canonical"]
                .as_array()
                .unwrap()
                .iter()
                .map(|x| x.as_str().unwrap().to_string())
                .collect();
            let mut al: Vec<(String, String)> = v["aliases"]
                .as_object()
                .unwrap()
                .iter()
                .map(|(k, x)| (k.clone(), x.as_str().unwrap().to_string()))
                .collect();
            al.sort();
            (canon, al)
        };
        assert_eq!(
            parse(&on_disk),
            parse(&domain_manifest()),
            "domain manifest is stale. Regenerate: \
             cargo test -p ingestion-worker export_domain_manifest -- --ignored"
        );
    }
}
