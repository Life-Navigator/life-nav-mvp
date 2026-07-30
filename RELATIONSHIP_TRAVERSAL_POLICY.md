# Relationship Traversal Policy

**Authoritative model:** `apps/ingestion-worker/src/relationship_catalog.rs`
**Enforced by:** `ontology::REGISTRY` gates (Rust) and `planner.allowed_edge_types` (Python)

---

## The rule

> No relationship becomes available to a query context merely because it exists in the graph.

Presence in data grants nothing. Membership in an edge family grants nothing. A relationship is
traversable in a context if and only if the catalog names that context in its `permitted_contexts`.

---

## Why traversability is not a Boolean

A single `traversable: bool` cannot express the distinction that actually matters here: _the personal
advisor may not follow this edge, but a provider advisor or an internal audit may._ Collapsing that into
one flag forces a choice between two wrong answers — expose provider data to users, or make provider
data permanently unreachable to the provider tooling that legitimately needs it.

So policy is declared **per context**:

| context            | implemented today | description                                                              |
| ------------------ | ----------------- | ------------------------------------------------------------------------ |
| `PersonalAdvisor`  | **yes**           | the user's own advisor. The only retrieval path in production.           |
| `ProviderAdvisor`  | no                | provider-facing retrieval. Needs its own authorization + tenancy design. |
| `OrgAdministrator` | no                | organization administration.                                             |
| `InternalAudit`    | no                | internal inspection and provenance review.                               |
| `CentralKnowledge` | no                | tenant-independent knowledge processing.                                 |

Only `PersonalAdvisor` has a planner. The others are declared so policy can be expressed ahead of
implementation — a context with no retrieval path is reported as `null`, not `0`, in the coverage
artifact, because "not built" and "nothing permitted" are different states and conflating them would
misrepresent readiness.

### The concrete failure a Boolean would have caused

Provider and Arcana B2B edges carry **ordinary families** — `identity`, `evidence`, `progress` — because
that is what they semantically are. `allowed_edge_types` selected purely by family. So a family-only
allowlist pulled `RECOMMENDED_BY_PROVIDER`, `AUTHORED_KNOWLEDGE`, `ANALYZED_BY_PROVIDER` and
`HAS_ARCANA_MEMBERSHIP` into personal retrieval, alongside the user's own facts.

Families are **semantic**, not **authorizational**. Treating one as the other is the bug.

`test_family_membership_alone_does_not_grant_traversal` exists specifically to fail if the policy filter
ever degenerates back into a no-op.

---

## Provider and Arcana B2B edges

All 19 default to:

```
traversable (personal advisor): false
personal_advisor_eligible:      false
max_hops:                       0
permitted_contexts:             [ProviderAdvisor, OrgAdministrator, InternalAudit]
permitted_principals:           [Provider, OrgAdministrator, System]
sensitivity:                    Restricted
```

Including, as called out explicitly:

- `ANALYZED_BY_PROVIDER`
- `AUTHORED_KNOWLEDGE`
- `HAS_ARCANA_MEMBERSHIP`
- `RECOMMENDED_BY_PROVIDER`

**These must not be enabled for personal-advisor retrieval without a separate authorization, tenancy and
query-context design.** That design does not exist yet and is tracked as an open policy decision in
`artifacts/graphrag-reconciliation/relationship_coverage.json`
(`unresolved_policy_decisions[provider-context-retrieval]`). It does **not** block personal-advisor
enablement, because the correct state for those edges today is unreachable.

---

## Fail-closed

| situation                          | behaviour                                                  |
| ---------------------------------- | ---------------------------------------------------------- |
| Relationship has no catalog row    | `spec_for` → `None` → refuse. CI fails the build.          |
| Row exists, context not listed     | refuse.                                                    |
| Row exists, `max_hops == 0`        | refuse expansion through the edge.                         |
| Manifest row missing `traversable` | treated as **not** traversable (Python loader).            |
| Manifest unreadable                | planner raises at import. No built-in fallback vocabulary. |

The Python loader's default deserves emphasis: `row.get("traversable") is True`. A row that never made a
decision is excluded. Defaulting to `True` is precisely how the provider edges would have leaked.

---

## Changing a policy

1. Edit the `RelationshipSpec` row in `relationship_catalog.rs`.
2. Regenerate: `cargo test -p ingestion-worker export_relationship_manifest -- --ignored`.
3. Run the gates: `cargo test -p ingestion-worker` and `pytest tests/test_relationship_traversal_policy.py`.
4. Regenerate coverage: `python scripts/graphrag/relationship_coverage.py …`.

Formatting-only changes to the registry pass without regeneration; semantic changes (rel type, family,
weight, lifecycle, traversability) fail `manifest_on_disk_matches_the_registry` until the manifest is
regenerated.

Widening a policy — especially adding `PersonalAdvisor` to a row that lacks it — is a **security
change**, not a retrieval-tuning change, and should be reviewed as one.
