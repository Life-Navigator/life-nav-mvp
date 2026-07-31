"""Architectural invariant enforcement — the properties that must never regress.

These tests do not verify features. They verify *architecture*: properties the platform's safety
arguments depend on, which are currently true and which nothing prevents a future commit from breaking
silently.

Each test names the invariant it protects, the regression it catches, and what breaks downstream if the
invariant is lost. If one of these fails, the correct response is never to relax the test — it is to
stop and treat the change as an architectural amendment.

Reference: docs/semantic-platform/implementation/IMPLEMENTATION_DECISION_AUDIT.md

    I-1   Exactly one graph writer (the Rust ingestion worker)
    I-2   Python graph clients are read-only
    I-3   Traversal binds tenant on EVERY node pattern, both endpoints
    I-4   Caller cannot override the bound tenant
    I-10  Relationship types never appear as raw string literals in retrieval code
"""
from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any

import pytest

from app.clients.neo4j import Neo4jClient
from app.grounding.semantic.planner import plan_query
from app.grounding.semantic.traversal import (
    allowed_edge_types,
    build_expand_cypher,
    build_lexical_seed_cypher,
    build_seed_cypher,
    traverse,
)

APP = Path(__file__).resolve().parent.parent / "app"

TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"


# ────────────────────────────────────────────────── I-1 / I-2 · single writer, read-only clients

# Cypher write verbs. `MATCH`/`RETURN`/`WITH` are reads; everything here mutates the graph.
_WRITE_CLAUSES = re.compile(
    r"\b(MERGE|CREATE|DELETE|DETACH\s+DELETE|SET|REMOVE|DROP|FOREACH|LOAD\s+CSV)\b"
)
# A Cypher statement is recognised by a read clause; this avoids flagging prose containing "SET".
_LOOKS_LIKE_CYPHER = re.compile(r"\b(MATCH|RETURN|UNWIND)\b")


def _python_string_literals(path: Path) -> list[str]:
    """Every string constant in a module, via AST — comments and docstrings are excluded by design.

    Regex over raw source would flag prose. Only real string constants can reach a driver.
    """
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError:  # pragma: no cover - a syntax error is a different test's problem
        return []
    out: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            out.append(node.value)
    # Module/class/function docstrings are string constants too — drop them.
    docstrings = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            doc = ast.get_docstring(node, clean=False)
            if doc:
                docstrings.add(doc)
    return [s for s in out if s not in docstrings]


def test_i1_no_write_cypher_anywhere_in_core_api():
    """I-1 · The Rust worker is the ONLY graph writer.

    Regression caught: a router or service issuing MERGE/CREATE/SET against Neo4j.

    Why it matters: ADR-002 makes provenance unbypassable by requiring a ProvenanceRef in the Rust
    edge-creation signature. That guarantee holds *only* because Rust is the sole writer. A Python
    write path would silently reintroduce provenance-free edges while the type system still claims
    they are impossible.
    """
    offenders: list[str] = []
    for path in APP.rglob("*.py"):
        for literal in _python_string_literals(path):
            if not _LOOKS_LIKE_CYPHER.search(literal):
                continue
            if _WRITE_CLAUSES.search(literal):
                offenders.append(f"{path.relative_to(APP.parent)}: {literal[:90]!r}")
    assert not offenders, (
        "Write Cypher found in core-api. The Rust ingestion worker is the only sanctioned graph "
        "writer (invariant I-1). Adding a Python write path breaks ADR-002's provenance guarantee.\n"
        + "\n".join(offenders)
    )


def test_i2_neo4j_client_exposes_no_write_method():
    """I-2 · The Python Neo4j client is read-only, by surface.

    Regression caught: a convenience `execute`/`write`/`run` helper added to the client, which would
    make I-1 unenforceable by inspection because any caller could then write.
    """
    public = {n for n in dir(Neo4jClient) if not n.startswith("_")}
    forbidden = {"write", "execute", "run", "merge", "create", "delete", "upsert", "commit", "tx"}
    found = {n for n in public if n.lower() in forbidden or n.lower().startswith("write")}
    assert not found, (
        f"Neo4jClient gained a write-shaped method: {sorted(found)}. The Python client is read-only "
        "(invariant I-2); all graph mutation goes through the Rust ingestion worker."
    )
    # The read surface is small and deliberate. New reads are fine; this documents today's contract.
    assert {"query_personal", "query_personal_dicts", "ready", "configured"} <= public | {"configured"}


# ────────────────────────────────────────────────── I-3 · tenant binding on every node pattern

# A node pattern is `(alias ...)` or `(alias:Label ...)`.
# `(?<![\w.])` excludes function calls — `type(r)`, `labels(b)`, `coalesce(x, y)` are not node
# patterns, and treating them as such produced false failures when this test was first written.
_NODE_PATTERN = re.compile(r"(?<![\w.])\((\w*)(?::[\w`]+)?\s*(\{[^}]*\})?\s*\)")
_TENANT_BINDING = "tenant_id: $user_id"


def _unbound_node_patterns(cypher: str) -> list[str]:
    """Node patterns that do not carry {tenant_id: $user_id}.

    A pattern bound by a prior clause (e.g. `(a)` reused after `MATCH (a {tenant_id: $user_id})`) is
    already constrained, so an alias seen bound earlier in the same statement is accepted.
    """
    bound_aliases: set[str] = set()
    unbound: list[str] = []
    for match in _NODE_PATTERN.finditer(cypher):
        alias, props = match.group(1), match.group(2) or ""
        if _TENANT_BINDING in props:
            if alias:
                bound_aliases.add(alias)
            continue
        if alias and alias in bound_aliases:
            continue  # constrained by an earlier clause in the same statement
        unbound.append(match.group(0))
    return unbound


ALL_BUILDERS = {
    "build_seed_cypher": build_seed_cypher(),
    "build_lexical_seed_cypher": build_lexical_seed_cypher(),
    "build_expand_cypher": build_expand_cypher(("HAS_GOAL", "HAS_EVIDENCE"), fan_out=12) or "",
}


@pytest.mark.parametrize("name,cypher", sorted(ALL_BUILDERS.items()))
def test_i3_every_node_pattern_binds_the_tenant(name: str, cypher: str):
    """I-3 · EVERY node pattern is tenant-scoped — including the far end of an expansion.

    Regression caught: `MATCH (a {tenant_id: $user_id})-[r]-(b)` — seed bound, neighbour unbound.
    That single omission is a cross-tenant read, and no feature test would notice because fixtures
    are single-tenant.

    This is the most severe invariant in the system: its loss is a data breach, not a defect.
    """
    assert cypher, f"{name} produced no Cypher"
    unbound = _unbound_node_patterns(cypher)
    assert not unbound, (
        f"{name} emits node pattern(s) with no tenant binding: {unbound}\n"
        f"Every node pattern must carry '{{{_TENANT_BINDING}}}' — including the neighbour in an "
        f"expansion. Cypher:\n{cypher}"
    )


def test_i3_every_builder_references_the_tenant_parameter():
    """I-3 · Defence in depth: the client refuses statements lacking $user_id, so a builder that
    forgot it would fail at runtime. This catches it at build time instead."""
    for name, cypher in ALL_BUILDERS.items():
        assert "$user_id" in cypher, f"{name} does not reference $user_id"


# ── the two-tenant fixture: the highest-value missing test ──────────────────────────────────────

class TwoTenantFakeNeo4j:
    """An in-memory graph holding data for TWO tenants that HONOURS the query's tenant predicate.

    This is what makes the test meaningful rather than tautological. A fake that returns canned rows
    proves nothing about isolation — it returns whatever the test author supplied. This fake instead
    *interprets* the tenant constraint in the generated Cypher:

      - if the Cypher binds the neighbour (`(b {tenant_id: $user_id})`), only same-tenant rows return;
      - if that binding is ever removed, foreign-tenant rows WILL be returned and the assertion below
        fails.

    So deleting the far-end tenant binding from build_expand_cypher turns this test red. That is
    precisely the regression I-3 exists to catch.
    """

    def __init__(self) -> None:
        # entity_id -> (tenant, label, title)
        self.nodes = {
            "a1": (TENANT_A, "UserProfile", "Tenant A root"),
            "a2": (TENANT_A, "Goal", "A goal"),
            "b1": (TENANT_B, "UserProfile", "Tenant B root"),
            "b2": (TENANT_B, "Goal", "B goal — MUST NEVER LEAK"),
        }
        # untenanted adjacency: a1->a2, a1->b2 (a deliberately corrupt cross-tenant edge), b1->b2
        self.edges = [("a1", "HAS_GOAL", "a2"), ("a1", "HAS_GOAL", "b2"), ("b1", "HAS_GOAL", "b2")]
        self.calls: list[dict[str, Any]] = []

    async def query_personal_dicts(self, statement: str, *, user_id: str, parameters=None):
        self.calls.append({"statement": statement, "user_id": user_id, "parameters": parameters})
        params = parameters or {}
        frontier = set(params.get("frontier") or params.get("ids") or [])
        visited = set(params.get("visited") or [])

        patterns = _NODE_PATTERN.findall(statement)
        # Does the statement constrain the *neighbour* (second pattern) by tenant?
        binds_source = any(_TENANT_BINDING in (p[1] or "") for p in patterns[:1])
        binds_neighbour = any(_TENANT_BINDING in (p[1] or "") for p in patterns[1:])

        rows = []
        for src, rel, dst in self.edges:
            if src not in frontier or dst in visited:
                continue
            if binds_source and self.nodes[src][0] != user_id:
                continue
            if binds_neighbour and self.nodes[dst][0] != user_id:
                continue  # ← the far-end tenant constraint doing its job
            tenant, label, title = self.nodes[dst]
            rows.append({
                "from_id": src, "rel": rel, "entity_id": dst, "labels": [label],
                "title": title, "summary": "", "domain": "general", "recency": None,
                "_tenant": tenant,  # test-only, so the assertion can detect a leak
            })
        return rows


@pytest.mark.asyncio
async def test_i3_two_tenant_traversal_returns_zero_foreign_tenant_nodes():
    """I-3 · THE isolation test: no traversal may return a node belonging to another tenant.

    Setup: two tenants share a store, and the graph deliberately contains a corrupt cross-tenant edge
    (a1 → b2). Even with corrupt data present, the *query* must not return b2, because both endpoints
    are tenant-bound.

    Regression caught: removing `{tenant_id: $user_id}` from the neighbour pattern in
    build_expand_cypher. The fake honours the predicate, so that change returns b2 and fails here.
    """
    neo = TwoTenantFakeNeo4j()
    plan = plan_query("what are my goals?")
    result = await traverse(neo, user_id=TENANT_A, plan=plan, seeds=[{"entity_id": "a1", "title": "Me"}])

    foreign = [n for n in result.nodes if neo.nodes.get(n.entity_id, (None,))[0] not in (TENANT_A, None)]
    assert not foreign, (
        "CROSS-TENANT LEAK: traversal returned nodes belonging to another tenant: "
        f"{[(n.entity_id, n.title) for n in foreign]}"
    )
    assert all(neo.nodes[n.entity_id][0] == TENANT_A for n in result.nodes if n.entity_id in neo.nodes)
    # And the tenant was bound on every executed query.
    for call in neo.calls:
        assert call["user_id"] == TENANT_A
        assert "$user_id" in call["statement"]


@pytest.mark.asyncio
async def test_i3_two_tenant_fixture_detects_an_unbound_neighbour():
    """Meta-test: proves the fixture above can actually fail.

    A gate that has never been demonstrated failing is decoration
    (IMPLEMENTATION_VERIFICATION_GATES.md §7). Here we hand the fake a deliberately defective
    statement — neighbour NOT tenant-bound — and assert the foreign node comes back. If this test
    ever passes trivially, the isolation test above has stopped being meaningful.
    """
    neo = TwoTenantFakeNeo4j()
    defective = (
        "MATCH (a {tenant_id: $user_id}) WHERE a.entity_id IN $frontier "
        "MATCH (a)-[r:HAS_GOAL]-(b) "  # ← neighbour deliberately unbound
        "RETURN b"
    )
    rows = await neo.query_personal_dicts(
        defective, user_id=TENANT_A, parameters={"frontier": ["a1"], "visited": []}
    )
    leaked = [r for r in rows if r["_tenant"] != TENANT_A]
    assert leaked, (
        "The two-tenant fixture no longer detects an unbound neighbour — the isolation test above "
        "has become tautological and must be repaired."
    )


# ────────────────────────────────────────────────── I-4 · tenant cannot be overridden by a caller

@pytest.mark.asyncio
async def test_i4_client_refuses_untenanted_statement():
    """I-4 · A personal-graph query with no $user_id reference is refused, not executed."""
    client = Neo4jClient(uri="neo4j+s://x", username="u", password="p", database="d")
    with pytest.raises(ValueError, match=r"\$user_id"):
        await client.query_personal_dicts("MATCH (n) RETURN n", user_id=TENANT_A)


@pytest.mark.asyncio
async def test_i4_client_refuses_caller_supplied_tenant():
    """I-4 · A caller cannot smuggle a different tenant through parameters."""
    client = Neo4jClient(uri="neo4j+s://x", username="u", password="p", database="d")
    with pytest.raises(ValueError, match="cannot override user_id"):
        await client.query_personal_dicts(
            "MATCH (n {tenant_id: $user_id}) RETURN n",
            user_id=TENANT_A,
            parameters={"user_id": TENANT_B},
        )


@pytest.mark.asyncio
async def test_i4_empty_tenant_is_refused():
    """I-4 · Fail closed: an empty tenant is never treated as a wildcard."""
    client = Neo4jClient(uri="neo4j+s://x", username="u", password="p", database="d")
    with pytest.raises(ValueError, match="non-empty user_id"):
        await client.query_personal_dicts("MATCH (n {tenant_id: $user_id}) RETURN n", user_id="")


# ────────────────────────────────────────────────── I-10 · no raw-string relationship emission

# Cypher-aware extraction. The first version of this gate tokenized on whitespace and reported ZERO
# literals in `retriever.py`, because Cypher writes them as `-[:HAS_EVIDENCE]->` — no whitespace
# boundary. That false negative is why this module now parses relationship *syntax* rather than words.
#
# Forms handled:
#   [:TYPE]              anonymous relationship
#   -[r:TYPE]->          bound variable
#   [:A|B|C]             alternation
#   [:`Odd Type`]        backtick-quoted
#   [r:TYPE*1..3]        with a range quantifier
_REL_CLAUSE = re.compile(r"\[\s*\w*\s*:\s*([^\]]+?)\s*(?:\*[^\]]*)?\]")
_REL_NAME = re.compile(r"`([^`]+)`|([A-Za-z_][A-Za-z0-9_]*)")
# An f-string that interpolates the relationship slot: `[r:{rels}]` — dynamic, undetectable by literal
# analysis, so it must come from the catalog. traversal.py legitimately does this.
_INTERPOLATED_REL = re.compile(r"\[\s*\w*\s*:\s*\{")


def _relationship_literals_in(text: str) -> set[str]:
    """Relationship type names appearing as literals inside Cypher relationship syntax."""
    out: set[str] = set()
    for clause in _REL_CLAUSE.findall(text):
        if "{" in clause:      # interpolated — not a literal
            continue
        for tick, plain in _REL_NAME.findall(clause):
            name = tick or plain
            if name:
                out.add(name)
    return out


def _manifest_relationship_types() -> set[str]:
    """The authoritative vocabulary, from the generated manifest.

    Membership here — not an uppercase-shape heuristic — is what makes the check exact. `MATCH`,
    `RETURN`, `ORDER` are uppercase Cypher keywords and are not relationship types.
    """
    import json

    data = json.loads((APP / "grounding" / "semantic" / "ontology_manifest.json").read_text("utf-8"))
    return {r["rel_type"] for r in data["relationships"]}


def _all_python_modules() -> list[Path]:
    return sorted(APP.rglob("*.py"))


def _literals_by_module() -> dict[str, set[str]]:
    """Every manifest relationship type appearing as a Cypher literal, per module — whole app."""
    vocabulary = _manifest_relationship_types()
    found: dict[str, set[str]] = {}
    for path in _all_python_modules():
        hits: set[str] = set()
        for literal in _python_string_literals(path):
            hits |= _relationship_literals_in(literal) & vocabulary
        if hits:
            found[str(path.relative_to(APP.parent))] = hits
    return found


# ── Known exceptions — PINNED, not whitelisted ──────────────────────────────────────────────────
#
# `retriever.py` is the LEGACY flat retriever, live as the GRAPH_RETRIEVAL_V2=false rollback path
# (dependencies.py:341-343, advisor_context.py:490). It hardcodes a fixed recommendation subgraph.
#
# WHY THIS IS NOT GENERATED FROM THE MANIFEST TODAY:
# the manifest is a FLAT list of relationship types with family/weight/traversable. It carries no
# notion of *subgraph shape* — that `HAS_EVIDENCE` binds `(e:Evidence)`, `HAS_TRADEOFF` binds
# `(t:Tradeoff)`, and each lands in a distinct OPTIONAL MATCH with its own RETURN projection.
# Deriving this Cypher from the manifest requires deciding how structure is expressed in the
# contract, which is an architectural decision, not a refactor. Attempting it would change the
# query and therefore the rollback path's behaviour.
#
# RECORDED DEPENDENCY: a manifest/catalog extension expressing subgraph shape. No accepted ADR
# covers it. Until then these five are pinned EXACTLY — the test below fails if the set changes in
# either direction, so this cannot grow silently and cannot be quietly deleted either.
_KNOWN_EXCEPTIONS: dict[str, set[str]] = {
    "app/grounding/retriever.py": {
        "HAS_RECOMMENDATION", "HAS_EVIDENCE", "HAS_ASSUMPTION", "HAS_TRADEOFF", "REQUIRES_REVIEW",
    },
}


def test_i10_extractor_detects_every_cypher_relationship_form():
    """The extractor must catch the forms the previous whitespace tokenizer missed."""
    cases = {
        "MATCH (a)-[:HAS_EVIDENCE]->(b)":            {"HAS_EVIDENCE"},
        "MATCH (a)-[r:HAS_GOAL]->(b)":               {"HAS_GOAL"},
        "MATCH (a)-[:HAS_GOAL|HAS_EVIDENCE]-(b)":    {"HAS_GOAL", "HAS_EVIDENCE"},
        "MATCH (a)-[:`HAS_GOAL`]->(b)":              {"HAS_GOAL"},
        "MATCH (a)-[r:HAS_GOAL*1..3]->(b)":          {"HAS_GOAL"},
        "OPTIONAL MATCH (r)-[:REQUIRES_REVIEW]->(b)": {"REQUIRES_REVIEW"},
        "MATCH (a)-[r:{rels}]-(b)":                  set(),   # interpolated -> catalog-derived
        "MATCH (n) RETURN n ORDER BY x DESC":        set(),   # keywords are not relationships
    }
    for cypher, expected in cases.items():
        assert _relationship_literals_in(cypher) == expected, f"extractor failed on: {cypher}"


def test_i10_no_unexpected_raw_relationship_literals_app_wide():
    """I-10 · Relationship types come from the generated catalog, never raw literals.

    Scope is the WHOLE app, not the four semantic modules the first version of this gate covered.
    Anything outside the pinned exceptions is a violation.
    """
    found = _literals_by_module()
    unexpected = {
        mod: sorted(types - _KNOWN_EXCEPTIONS.get(mod, set()))
        for mod, types in found.items()
        if types - _KNOWN_EXCEPTIONS.get(mod, set())
    }
    assert not unexpected, (
        "Raw relationship-type literal(s) outside the pinned exceptions — derive from the generated "
        f"manifest instead (invariant I-10):\n{unexpected}"
    )


def test_i10_known_exceptions_are_pinned_exactly():
    """The exception set may not grow — and may not silently shrink either.

    A whitelist that can grow is not a control. Pinning both directions means removing a literal is
    also a deliberate, reviewed act (it would mean the rollback path changed).
    """
    found = _literals_by_module()
    for mod, expected in _KNOWN_EXCEPTIONS.items():
        actual = found.get(mod, set())
        assert actual == expected, (
            f"Pinned exception drift in {mod}.\n  expected: {sorted(expected)}\n"
            f"  actual:   {sorted(actual)}\n"
            "Adding a literal here requires review; removing one means the rollback path changed."
        )


def test_i10_every_cypher_building_module_is_covered():
    """Guards against the scope defect that caused the original false negative.

    If a new module starts building Cypher, this fails until it is acknowledged — the previous gate
    silently covered only four files.
    """
    builders = {
        str(p.relative_to(APP.parent))
        for p in _all_python_modules()
        if any("MATCH (" in lit for lit in _python_string_literals(p))
    }
    assert builders == {"app/grounding/retriever.py", "app/grounding/semantic/traversal.py"}, (
        f"The set of Cypher-building modules changed: {sorted(builders)}. Every one must be covered "
        "by I-10 enforcement; update this assertion deliberately."
    )


def test_i10_edge_types_are_derived_from_the_manifest_not_hardcoded():
    plan = plan_query("what are my goals?")
    edges = allowed_edge_types(plan)
    assert edges, "allowed_edge_types returned nothing — the manifest-derived path is broken"
    assert set(edges) <= _manifest_relationship_types(), "traversal proposed a non-manifest type"


def test_i10_traversal_uses_interpolation_not_literals():
    """The semantic engine must build its relationship clause from the catalog, never inline it."""
    src = (APP / "grounding" / "semantic" / "traversal.py").read_text("utf-8")
    assert _INTERPOLATED_REL.search(src), "traversal.py no longer interpolates its relationship types"
    literals = set()
    for lit in _python_string_literals(APP / "grounding" / "semantic" / "traversal.py"):
        literals |= _relationship_literals_in(lit) & _manifest_relationship_types()
    assert not literals, f"traversal.py hardcodes relationship types: {sorted(literals)}"


def test_i10_related_to_is_never_traversable():
    """RELATED_TO is a compatibility fallback carrying no semantics; it must stay non-traversable."""
    for query in ("what are my goals?", "how much debt do I have?", "compare these schools"):
        assert "RELATED_TO" not in allowed_edge_types(plan_query(query))


def test_i10_exception_cannot_be_copied_into_another_module():
    """The exception is scoped to ONE module and may not spread.

    An exception that can be copied is not an exception, it is a precedent. `retriever.py` is
    excepted because it predates the catalog contract and is the rollback path; nothing else is.

    Owner: Graph Platform · Removal trigger: a manifest/catalog extension expressing subgraph shape
    (no accepted ADR — see OQ_INVESTIGATION_FINDINGS.md §A) · Backlog: B-15/B-16 adjacent.
    """
    assert set(_KNOWN_EXCEPTIONS) == {"app/grounding/retriever.py"}, (
        f"The I-10 exception set gained or lost a module: {sorted(_KNOWN_EXCEPTIONS)}. Exactly one "
        "module is excepted. Adding another requires an architectural decision, not a test edit."
    )
    # And prove the enforcement is path-keyed: the same literals elsewhere are still violations.
    vocabulary = _manifest_relationship_types()
    excepted = _KNOWN_EXCEPTIONS["app/grounding/retriever.py"]
    assert excepted <= vocabulary, "the excepted set drifted out of the manifest vocabulary"
    sample = "OPTIONAL MATCH (r)-[:HAS_EVIDENCE]->(e:Evidence)"
    assert _relationship_literals_in(sample) & vocabulary, (
        "the extractor no longer detects the excepted forms — copying them elsewhere would go "
        "unnoticed"
    )
