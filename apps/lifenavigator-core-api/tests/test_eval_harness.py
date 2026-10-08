"""Tests OF the evaluation harness.

An eval nobody tests is a number nobody should trust. The properties below are the ones that decide
whether its output means anything:

  * UNMEASURED never looks like a pass. ("nothing ran" vs "everything passed")
  * trust and quality rates are never combined, and never contaminate each other.
  * a refusal to score is not counted as a failure.
  * a baseline from a different fixture version is refused, not silently compared.
  * the probes call the PRODUCTION code, so the harness cannot drift from what ships.
"""
import json
import pathlib

import pytest

from eval import probe_gate, probe_routing
from eval.model import CaseResult, GateCase, RoutingCase
from eval.scorecard import ProbeScore, compare, render, score


# ── UNMEASURED is never a pass ───────────────────────────────────────────────────────────────────
def test_a_probe_with_no_cases_reports_unmeasured_not_success():
    s = score("empty", "1", [])
    assert s.status == "UNMEASURED"
    assert s.measured is False
    assert s.over_block_rate is None and s.under_block_rate is None
    assert "UNMEASURED" in render([s], [compare(s)])


def test_refused_cases_do_not_become_failures():
    """A retrieval case with no relevance labels is unscoreable. Counting it as a quality failure is
    exactly what this harness reported before `refused` existed — four unlabelled stubs read as
    'over-block 100%', which would have been a damning and entirely fictional number."""
    s = score("p", "1", [
        CaseResult("a", "must_pass", "labelled", "UNLABELLED", ok=False, refused=True),
        CaseResult("b", "must_pass", "labelled", "UNLABELLED", ok=False, refused=True),
    ])
    assert s.refused == 2
    assert s.must_pass_total == 0
    assert s.over_block_rate is None
    assert s.status == "UNMEASURED"


# ── The two rates stay separate ──────────────────────────────────────────────────────────────────
def test_trust_and_quality_rates_are_computed_independently():
    """A trust failure must not be dilutable by quality passes, or vice versa. There is deliberately
    no overall score — averaging would let a gate trade a fabrication for a quality win."""
    s = score("p", "1", [
        CaseResult("q1", "must_pass", "passed", "blocked", ok=False),   # 1 of 2 over-blocked
        CaseResult("q2", "must_pass", "passed", "passed", ok=True),
        CaseResult("t1", "must_block", "blocked", "blocked", ok=True),  # 0 of 4 under-blocked
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t3", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t4", "must_block", "blocked", "blocked", ok=True),
    ])
    assert s.over_block_rate == 50.0
    assert s.under_block_rate == 0.0
    assert not hasattr(s, "overall_score")


def test_render_never_prints_a_combined_score():
    s = score("p", "1", [
        CaseResult("q", "must_pass", "passed", "blocked", ok=False),
        CaseResult("t", "must_block", "blocked", "passed", ok=False),
    ])
    out = render([s], [compare(s)])
    assert "TRUST" in out and "QUALITY" in out
    assert "overall" not in out.lower()


# ── Baselines ────────────────────────────────────────────────────────────────────────────────────
def test_a_baseline_from_a_different_fixture_version_is_refused(tmp_path, monkeypatch):
    """Scoring against a baseline built from another case set reports an easier question as
    progress. Refused rather than warned, because a warning in CI output is a warning nobody reads."""
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    s_old = score("p", "1", [CaseResult("t", "must_block", "blocked", "blocked", ok=True)])
    sc.save_baseline(s_old)
    s_new = score("p", "2", [CaseResult("t", "must_block", "blocked", "blocked", ok=True)])
    v = sc.compare(s_new)
    assert v.ok is False
    assert "REFUSING to compare" in " ".join(v.lines)


def test_a_worsened_rate_fails_and_an_improved_one_does_not(tmp_path, monkeypatch):
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    base = score("p", "1", [
        CaseResult("t1", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
    ])
    sc.save_baseline(base)

    worse = score("p", "1", [
        CaseResult("t1", "must_block", "blocked", "passed", ok=False),   # a fabrication got through
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
    ])
    assert sc.compare(worse).ok is False

    better = score("p", "1", [
        CaseResult("t1", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
    ])
    assert sc.compare(better).ok is True


def test_a_baseline_is_never_written_for_an_unmeasured_probe(tmp_path, monkeypatch):
    """A baseline that asserts nothing looks like a gate while being one. Worse than none."""
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    from eval.run import main
    rc = main(["--probe", "retrieval", "--save-baseline"])
    assert rc == 0
    assert not (tmp_path / "retrieval.json").exists()


# ── Known divergences are counted, not hidden ────────────────────────────────────────────────────
def test_known_divergences_are_counted_but_do_not_fail_ci():
    s = score("p", "1", [
        CaseResult("k", "must_pass", "passed", "blocked", ok=False,
                   known_divergence="documented over-block"),
    ])
    assert s.known_divergences == 1
    assert s.over_block_rate == 100.0, "still counted in the rate — a known failure is still a failure"
    assert compare(s).ok is True, "but not a CI regression on its own"


# ── The probes measure the REAL production code ──────────────────────────────────────────────────
def test_gate_probe_calls_the_production_validator():
    """A harness that reimplemented the gate would drift from the thing that ships — the failure the
    ontology manifest and the cross-language parity fixture exist to prevent elsewhere here."""
    import inspect
    import eval.probe_gate as pg
    assert "advisor_validator" in inspect.getsource(pg)

    blocked = pg.evaluate_case(GateCase(
        id="x", text="Your net worth is $1,284,500 right now.", direction="must_block"))
    assert blocked.ok and blocked.actual == "blocked"

    grounded = pg.evaluate_case(GateCase(
        id="y", text="Your cash position leaves $6,800 a month.", direction="must_pass",
        allowed=("6800",)))
    assert grounded.ok and grounded.actual == "passed"


def test_routing_probe_calls_the_production_classifiers():
    import inspect
    import eval.probe_routing as pr
    assert "model_router" in inspect.getsource(pr)

    r = pr.evaluate_case(RoutingCase(
        id="x", message="I cannot breathe", expect_domain="health",
        expect_urgent="trouble breathing"))
    assert r.ok, r.actual


def test_a_safety_case_is_scored_only_on_the_safety_net():
    """Mixing a domain assertion into a safety case would let a domain mismatch mask a missed
    emergency inside the same number."""
    r = probe_routing.evaluate_case(RoutingCase(
        id="x", message="my face is drooping", expect_domain="WRONG_ON_PURPOSE",
        expect_urgent="stroke symptoms"))
    assert r.ok is True
    assert r.direction == "must_block"


# ── The shipped fixture sets ─────────────────────────────────────────────────────────────────────
def test_shipped_gate_fixtures_are_two_sided():
    """A one-sided set produces a meaningless rate: all-must_block makes any gate look perfect on
    trust, all-must_pass makes it look perfect on quality."""
    s = probe_gate.run()
    assert s.must_pass_total >= 3 and s.must_block_total >= 3


def test_shipped_routing_fixtures_cover_the_safety_net_both_ways():
    cases = probe_routing.load_routing_cases()
    assert any(c.expect_urgent for c in cases), "no must-fire safety case"
    assert any("safety_false_positive" in c.tags for c in cases), "no must-NOT-fire safety case"


def test_the_safety_net_is_currently_perfect_and_must_stay_that_way():
    """The one metric in this harness with a medical consequence. Not a baseline comparison — an
    absolute: a missed emergency is never an acceptable regression."""
    s = probe_routing.run()
    assert s.must_block_total > 0
    assert s.must_block_passed == 0, (
        f"{s.must_block_passed} urgent-care case(s) were missed — this must always be zero"
    )


def test_every_fixture_case_explains_itself():
    """A case with no `why` is unmaintainable: the next person cannot tell whether a failure means
    the code broke or the expectation was wrong — which happened three times while authoring these."""
    for c in probe_gate.load_gate_cases():
        assert c.why.strip(), f"gate case {c.id} has no rationale"
    for c in probe_routing.load_routing_cases():
        assert c.why.strip(), f"routing case {c.id} has no rationale"


def test_fixtures_are_versioned():
    from eval.model import fixture_version
    for f in ("gate_cases.json", "routing_cases.json"):
        assert fixture_version(f) not in ("absent", "unversioned"), f


# ── The CLI ──────────────────────────────────────────────────────────────────────────────────────
def test_cli_runs_the_offline_probes_and_exits_zero(capsys, tmp_path, monkeypatch):
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    from eval.run import main
    assert main([]) == 0
    out = capsys.readouterr().out
    assert "gate" in out and "routing" in out


def test_cli_json_output_is_machine_readable(tmp_path, monkeypatch):
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    from eval.run import main
    out = tmp_path / "scorecard.json"
    assert main(["--probe", "gate", "--json", str(out)]) == 0
    doc = json.loads(out.read_text())
    probe = doc["probes"][0]
    assert probe["probe"] == "gate"
    assert "over_block_rate_pct" in probe and "under_block_rate_pct" in probe
    assert "refused_unscoreable" in probe


def test_the_offline_set_needs_no_credentials_model_or_network():
    """The property that lets this run on every PR. If an offline probe ever reached for a store or
    a key it would quietly stop running in CI and the gate would silently disappear.

    Checked by parsing IMPORTS rather than grepping source text — an earlier version grepped for
    "Neo4jClient" and tripped on the word appearing in a docstring, which is a test that fails for
    documentation rather than for behaviour.
    """
    import ast
    import inspect

    import eval.graph_world as gw
    import eval.probe_gate as pg
    import eval.probe_retrieval as prt
    import eval.probe_routing as pr
    from eval.run import OFFLINE

    assert set(OFFLINE) == {"gate", "routing", "retrieval_synthetic"}

    # Modules that imply a credential, a network call or a live store.
    FORBIDDEN = {"httpx", "requests", "supabase", "aiohttp", "urllib.request", "socket"}

    for mod in (pg, pr, prt, gw):
        tree = ast.parse(inspect.getsource(mod))
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported |= {a.name for a in node.names}
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
        offending = {m for m in imported if any(m == f or m.startswith(f + ".") for f in FORBIDDEN)}
        assert not offending, f"{mod.__name__} imports {offending}"
        # The app's real store CLIENTS must not be imported either — the doubles stand in for them.
        assert not {m for m in imported if m.startswith("app.clients")}, (
            f"{mod.__name__} imports a real store client"
        )


# ── Synthetic graph retrieval (probe B, offline mode) ────────────────────────────────────────────
@pytest.mark.asyncio
async def test_synthetic_retrieval_behaviour_cases_all_pass():
    """Retrieval BEHAVIOUR over a declared graph — the gate the existing 65 GraphRAG tests cannot
    provide, because their fakes replay scripted rows rather than containing a graph."""
    from eval import probe_retrieval
    s = await probe_retrieval.run_synthetic()
    assert s.measured
    assert s.must_pass_blocked == 0, [r.case_id for r in s.results if not r.ok]


@pytest.mark.asyncio
async def test_the_cross_domain_regression_is_guarded():
    """The bug this fixture found on first run: the engine filtered vector seeding to
    plan.domains[0], so a query planned as ('family','financial','education') was narrowed to
    `family` — whose only node was a pet record — and returned NOTHING on the headline cross-domain
    question GraphRAG exists to answer."""
    from eval.probe_retrieval import build_world_engine
    engine, _ = build_world_engine()
    evidence, _t = await engine.retrieve(
        "Can I retire at 55 and still fund college for my kids?", user_id="user-a", limit=20)
    ids = {e.get("entity_id") for e in evidence}
    assert "a-goal-college" in ids and "a-goal-retire" in ids, ids
    assert len(ids) >= 4


def test_multi_domain_plans_are_not_narrowed_to_one_domain():
    """Pinned on the helper directly, independent of any fixture."""
    from app.grounding.semantic.engine import _seed_domain_filter
    assert _seed_domain_filter(()) is None
    assert _seed_domain_filter(("financial",)) == "financial"
    assert _seed_domain_filter(("family", "financial", "education")) is None, (
        "a cross-domain question must not be filtered to one of its domains"
    )


@pytest.mark.asyncio
async def test_non_traversable_edges_are_never_followed():
    """RELATED_TO is traversable=false in the manifest. Following it would flood the prompt with
    irrelevant nodes at Opus input rates — recall is not free."""
    from eval.probe_retrieval import build_world_engine
    engine, _ = build_world_engine()
    evidence, _t = await engine.retrieve(
        "Can I retire at 55 and still fund college for my kids?", user_id="user-a", limit=20)
    assert "a-unrelated-pet" not in {e.get("entity_id") for e in evidence}


@pytest.mark.asyncio
async def test_no_other_tenants_node_is_ever_returned():
    """The world CONTAINS user-b, whose nodes are titled to score highly on this query — so a leak
    would be caught by the vector seeding rather than being merely possible in theory."""
    from eval.probe_retrieval import build_world_engine
    engine, neo = build_world_engine()
    evidence, _t = await engine.retrieve(
        "Can I retire at 55 and still fund college for my kids?", user_id="user-a", limit=20)
    ids = {e.get("entity_id") for e in evidence}
    assert ids, "vacuous: nothing retrieved, so isolation would pass trivially"
    assert not any(str(i).startswith("b-") for i in ids), ids
    assert neo.tenants_seen == {"user-a"}


def test_the_world_uses_only_real_manifest_relationship_types():
    """An edge whose type is absent from the generated manifest is rejected by _validate_rel_types
    and can never be traversed, so a world built from invented types proves nothing. v1 of this
    fixture did exactly that — CONFLICTS_WITH, SUPPORTS and EVIDENCES do not exist."""
    from eval.graph_world import GraphWorld
    manifest = json.loads(
        (pathlib.Path(__file__).parent.parent
         / "app/grounding/semantic/ontology_manifest.json").read_text())
    known = {r["rel_type"] for r in manifest["relationships"]}
    unknown = sorted({e.rel for e in GraphWorld.load().edges} - known)
    assert not unknown, f"fixture uses types absent from the manifest: {unknown}"


def test_the_world_uses_canonical_domain_values():
    """normalize_domain('finance') == 'financial'. Storing the non-canonical spelling makes a node
    unreachable through the domain filter while retrieval still reports success — the data-side form
    of the defect that made 71% of the corpus unreachable. v2 of this fixture reproduced it."""
    from app.grounding.semantic.domains import normalize_domain
    from eval.graph_world import GraphWorld
    for n in GraphWorld.load().nodes.values():
        assert normalize_domain(n.domain) == n.domain, (
            f"{n.entity_id} has non-canonical domain {n.domain!r} "
            f"(canonical: {normalize_domain(n.domain)!r})"
        )


def test_the_world_contains_a_second_tenant():
    from eval.graph_world import GraphWorld
    tenants = {n.tenant_id for n in GraphWorld.load().nodes.values()}
    assert len(tenants) >= 2, "isolation cannot be tested against a single-tenant graph"
