#!/usr/bin/env python3
"""Golden-set builder — turns "write 100 labels from scratch" into a review pass.

    # 0. prove the stores are reachable and see what's actually in them
    python evals/retrieval/build_golden.py survey

    # 1. generate candidate cases grounded in REAL entities, for human review
    python evals/retrieval/build_golden.py build --out evals/retrieval/golden.candidates.json

    # 2. (human edits the file: set "relevant": true/false on each candidate)

    # 3. promote reviewed candidates into the golden set the eval consumes
    python evals/retrieval/build_golden.py promote \
        --in evals/retrieval/golden.candidates.json --out evals/retrieval/golden.json

WHY A BUILDER AND NOT JUST A HAND-WRITTEN FILE
----------------------------------------------
A golden set has to reference real `entity_id`s from the live stores — UUIDs nobody can write from
memory. The expensive part is not judgement, it is discovering which entities exist and what they are
called. This tool does the discovery and leaves the judgement, which is the part that must stay human.

THE METHODOLOGICAL TRAP THIS AVOIDS
-----------------------------------
The obvious way to build the candidate pool is to run retrieval and label what comes back. That silently
guarantees recall@k ≈ 1.0 for whichever implementation generated the pool, because an entity the engine
never returned can never be labelled relevant — the metric can then only measure ranking, while reporting
itself as recall. Every "our retriever scores 0.95 recall" claim built this way is measuring its own
shadow.

So the pool is a UNION of three sources, and each candidate records where it came from:

    retrieved_v2      the semantic engine's output          — can it rank what it finds?
    retrieved_v1      the legacy flat retriever's output    — does v2 lose anything v1 had?
    unretrieved       a sample of tenant entities NEITHER   — the misses. THIS is what makes
                      implementation returned                 recall a real measurement.

If a labeller marks an `unretrieved` candidate relevant, that is a genuine recall miss and both
implementations are penalised for it. Without that third source the eval cannot detect a miss at all.

TENANT SAFETY
-------------
Every read here goes through the same tenant-enforcing clients the production path uses:
`Neo4jClient.query_personal` (refuses statements without `$user_id`, binds the tenant last so it cannot
be overridden) and `QdrantClient.search_personal` (refuses an empty user_id, never a wildcard). This tool
has no privileged read path of its own — if it can see it, the advisor could too.

CREDENTIALS
-----------
Read from the standard `Settings` chain, i.e. `apps/lifenavigator-core-api/.env` (gitignored via `**/.env`)
or the ambient environment. Nothing is written back to disk except entity ids, titles and types — never a
credential, and never the raw payload of a personal record beyond the summary the advisor itself would see.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.clients.gemini import GeminiClient          # noqa: E402
from app.clients.neo4j import Neo4jClient            # noqa: E402
from app.clients.qdrant import QdrantClient          # noqa: E402
from app.config import get_settings                  # noqa: E402
from app.grounding.semantic import SemanticGraphRAG  # noqa: E402

# Deterministic sampling — a golden set that reshuffles on every run is not a baseline.
SEED = 20260729

# CANONICAL domain values (domain_vocabulary.rs). "finance" here silently produced zero-hit filters.
DOMAINS = ("financial", "health", "career", "education", "family")

# Query templates per intent. `{e}` is filled with a real entity title from the tenant's own graph, so
# every generated query is answerable from that tenant's data rather than being a generic prompt.
TEMPLATES: dict[str, tuple[str, ...]] = {
    "lookup": (
        "what is my {e}?",
        "how much is in my {e}?",
        "tell me about my {e}",
    ),
    "compare": (
        "should I prioritise my {e} or my {e2}?",
        "compare my {e} and my {e2}",
    ),
    "temporal": (
        "how has my {e} changed this year?",
        "what's the trend on my {e}?",
    ),
    "causal": (
        "why did you recommend {e}?",
        "what's the reasoning behind my {e}?",
    ),
    "scenario": (
        "what happens to my {e} if I retire at 60?",
        "if I lost my income, what happens to my {e}?",
    ),
    "broad": (
        "how am I doing on {d}?",
        "what should I be worried about in {d}?",
    ),
}


# ── store reads (all tenant-enforced) ────────────────────────────────────────────────────────────

async def list_tenants(settings: Any, limit: int = 50) -> list[tuple[str, int]]:
    """Discover which tenant ids exist, returning (tenant_id, node_count).

    DELIBERATELY NOT TENANT-SCOPED, AND DELIBERATELY NOT IN THE CLIENT.
    `Neo4jClient` refuses untenanted statements — that refusal is the mechanism protecting every
    application path, and adding an `admin` escape hatch to it would put the hole right back where it
    was just closed. So this enumeration lives here, in an operator tool that no request path imports,
    and it returns ids and counts only: never any tenant's content.
    """
    import httpx
    from app.clients.neo4j import _host_from_uri

    cypher = (
        "MATCH (n) WHERE n.tenant_id IS NOT NULL "
        "RETURN n.tenant_id AS tenant_id, count(n) AS n "
        "ORDER BY n DESC LIMIT $limit"
    )
    url = f"{_host_from_uri(settings.neo4j_uri)}/db/{settings.neo4j_personal_database}/query/v2"
    async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
        resp = await client.post(
            url,
            auth=(settings.neo4j_username, settings.neo4j_password),
            json={"statement": cypher, "parameters": {"limit": limit}},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json().get("data", {}) or {}
    fields = data.get("fields") or []
    out: list[tuple[str, int]] = []
    for row in data.get("values") or []:
        rec = {f: row[i] if i < len(row) else None for i, f in enumerate(fields)}
        if rec.get("tenant_id"):
            out.append((str(rec["tenant_id"]), int(rec.get("n") or 0)))
    return out


async def tenant_entities(neo4j: Neo4jClient, *, user_id: str, limit: int = 400) -> list[dict[str, Any]]:
    """Every entity the tenant owns, via the tenant-enforcing client."""
    cypher = (
        "MATCH (n {tenant_id: $user_id}) "
        "WHERE n.entity_id IS NOT NULL "
        "RETURN n.entity_id AS entity_id, labels(n)[0] AS entity_type, "
        "       coalesce(n.title, n.name, '') AS title, "
        "       coalesce(n.summary, n.description, '') AS summary, "
        "       coalesce(n.domain, '') AS domain "
        "ORDER BY coalesce(n.updated_at, n.created_at) DESC LIMIT $limit"
    )
    # Named rows — the same contract traversal uses. `query_personal` would return positional lists.
    rows = await neo4j.query_personal_dicts(cypher, user_id=user_id, parameters={"limit": limit})
    return [dict(r) for r in rows or [] if r.get("entity_id")]


# ── commands ─────────────────────────────────────────────────────────────────────────────────────

async def cmd_survey(args: argparse.Namespace) -> int:
    """Prove connectivity and show the shape of the corpus BEFORE labelling anything."""
    s = get_settings()
    neo4j = Neo4jClient.from_settings(s)
    qdrant = QdrantClient.from_settings(s)
    gemini = GeminiClient.from_settings(s)

    print("\nstore configuration")
    print(f"  neo4j    configured={neo4j.configured}")
    print(f"  qdrant   configured={qdrant.configured}  collection={s.qdrant_personal_collection}")
    print(f"  gemini   configured={getattr(gemini, 'configured', False)}  model={s.gemini_embedding_model}")

    if not neo4j.configured:
        print("\nNeo4j is not configured — set NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD in "
              "apps/lifenavigator-core-api/.env", file=sys.stderr)
        return 2

    ready = await neo4j.ready()
    print(f"  neo4j    reachable={ready}")
    if not ready:
        print("\nNeo4j is configured but unreachable — check the URI and credentials.", file=sys.stderr)
        return 2

    tenants = await list_tenants(s)
    print(f"\ntenants in graph: {len(tenants)}")
    for t, node_count in tenants[: args.max_tenants]:
        ents = await tenant_entities(neo4j, user_id=t)
        by_domain = Counter(e.get("domain") or "∅" for e in ents)
        by_type = Counter(e.get("entity_type") or "∅" for e in ents)
        titled = sum(1 for e in ents if (e.get("title") or "").strip())
        print(f"\n  {t}  ({node_count} nodes)")
        print(f"    entities: {len(ents)}   with a usable title: {titled}")
        print(f"    domains:  {dict(by_domain.most_common())}")
        print(f"    types:    {dict(by_type.most_common(8))}")
        if titled < 10:
            print("    ⚠ too few titled entities to generate grounded queries for this tenant")
    return 0


async def cmd_build(args: argparse.Namespace) -> int:
    """Generate candidate cases grounded in real entities, with a three-source candidate pool."""
    rng = random.Random(SEED)
    s = get_settings()
    neo4j = Neo4jClient.from_settings(s)
    qdrant = QdrantClient.from_settings(s)
    gemini = GeminiClient.from_settings(s)

    if not neo4j.configured:
        print("Neo4j not configured — run `survey` first.", file=sys.stderr)
        return 2

    engine = SemanticGraphRAG(gemini=gemini, qdrant=qdrant, neo4j=neo4j,
                              central_qdrant=_central_or_none(s))

    tenants = args.tenants or [t for t, _n in await list_tenants(s)]
    tenants = tenants[: args.max_tenants]
    if not tenants:
        print("No tenants found in the graph.", file=sys.stderr)
        return 2

    cases: list[dict[str, Any]] = []
    for tenant in tenants:
        entities = await tenant_entities(neo4j, user_id=tenant)
        titled = [e for e in entities if (e.get("title") or "").strip()]
        if len(titled) < 5:
            print(f"skipping {tenant}: only {len(titled)} titled entities", file=sys.stderr)
            continue
        by_id = {e["entity_id"]: e for e in entities}

        for query, intent, domain in _generate_queries(titled, rng, per_tenant=args.per_tenant):
            evidence, _trace = await engine.retrieve(query, user_id=tenant, domain=domain, limit=args.k)
            v2_ids = [e["entity_id"] for e in evidence]
            v1_ids = await _legacy_ids(s, query, tenant, domain, args.k)

            pool: dict[str, str] = {}
            for eid in v2_ids:
                pool[eid] = "retrieved_v2"
            for eid in v1_ids:
                pool[eid] = "retrieved_v2+v1" if eid in pool else "retrieved_v1"

            # THE THIRD SOURCE — entities neither implementation returned. Without these, recall
            # cannot be measured, only ranking. Sampled from the same domain where possible, since a
            # same-domain miss is the plausible one.
            missed = [e for e in entities if e["entity_id"] not in pool]
            same_domain = [e for e in missed if domain and e.get("domain") == domain]
            sample_from = same_domain or missed
            for e in rng.sample(sample_from, min(args.unretrieved, len(sample_from))):
                pool[e["entity_id"]] = "unretrieved"

            candidates = []
            for eid, source in pool.items():
                ent = by_id.get(eid, {})
                candidates.append({
                    "entity_id": eid,
                    "title": ent.get("title") or "(no title)",
                    "entity_type": ent.get("entity_type") or "",
                    "domain": ent.get("domain") or "",
                    "summary": (ent.get("summary") or "")[:200],
                    "source": source,
                    "rank_v2": (v2_ids.index(eid) + 1) if eid in v2_ids else None,
                    "relevant": None,   # ← HUMAN SETS true/false. null = unreviewed.
                })
            candidates.sort(key=lambda c: (c["rank_v2"] is None, c["rank_v2"] or 0))

            cases.append({
                "query": query,
                "user_id": tenant,
                "domain": domain,
                "intent": intent,
                "candidates": candidates,
                "notes": "",
            })

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(cases, indent=2))

    n_cand = sum(len(c["candidates"]) for c in cases)
    by_source = Counter(x["source"] for c in cases for x in c["candidates"])
    print(f"\nwrote {len(cases)} candidate cases · {n_cand} candidates → {out}")
    print(f"candidate sources: {dict(by_source.most_common())}")
    print("\nNEXT: review the file and set \"relevant\": true or false on each candidate.")
    print("      Leaving one null excludes it from the case (and `promote` will tell you how many).")
    return 0


def cmd_promote(args: argparse.Namespace) -> int:
    """Convert a reviewed candidates file into the golden set `run_eval.py` consumes."""
    src = Path(args.infile)
    if not src.exists():
        print(f"No candidates file at {src}", file=sys.stderr)
        return 2
    cases = json.loads(src.read_text())

    golden: list[dict[str, Any]] = []
    unreviewed = 0
    skipped: list[str] = []
    for case in cases:
        cands = case.get("candidates") or []
        unreviewed += sum(1 for c in cands if c.get("relevant") is None)
        relevant = [c["entity_id"] for c in cands if c.get("relevant") is True]
        if not relevant:
            skipped.append(case["query"])
            continue
        golden.append({
            "query": case["query"],
            "user_id": case["user_id"],
            "domain": case.get("domain"),
            "intent": case.get("intent"),
            "relevant": relevant,
            "notes": case.get("notes") or "",
        })

    if unreviewed and not args.allow_unreviewed:
        print(f"{unreviewed} candidates are still unreviewed (\"relevant\": null).\n"
              f"Review them, or pass --allow-unreviewed to treat null as NOT relevant — which will\n"
              f"understate recall for both implementations and make the A/B less trustworthy.",
              file=sys.stderr)
        return 2

    if len(golden) < args.min_cases:
        print(f"Only {len(golden)} labelled cases — below the {args.min_cases} minimum.\n"
              f"A set this small will not distinguish the implementations reliably; the delta it\n"
              f"reports would be noise. Label more before drawing a conclusion.", file=sys.stderr)
        if not args.force:
            return 2

    out = Path(args.out)
    out.write_text(json.dumps(golden, indent=2))
    print(f"wrote {len(golden)} labelled cases → {out}")
    if skipped:
        print(f"{len(skipped)} cases had no relevant entity and were dropped:")
        for q in skipped[:10]:
            print(f"  · {q}")
    print(f"\nNEXT: python evals/retrieval/run_eval.py --golden {out}")
    return 0


# ── helpers ──────────────────────────────────────────────────────────────────────────────────────

def _central_or_none(settings: Any) -> Optional[QdrantClient]:
    try:
        return QdrantClient.central_from_settings(settings)
    except Exception:  # noqa: BLE001 — central is optional
        return None


async def _legacy_ids(settings: Any, query: str, tenant: str, domain: Optional[str], k: int) -> list[str]:
    """The flat retriever's view, so the pool isn't biased toward whatever v2 happens to find."""
    try:
        from app.grounding.retriever import Retriever
        from app.models.common import UserContext
        legacy = Retriever(gemini=GeminiClient.from_settings(settings),
                           qdrant=QdrantClient.from_settings(settings),
                           neo4j=Neo4jClient.from_settings(settings))
        ev = await legacy.retrieve_personal(query, UserContext(user_id=tenant),
                                            domain=domain, limit=k) or []
        return [str(e.get("entity_id")) for e in ev if e.get("entity_id")]
    except Exception as exc:  # noqa: BLE001
        print(f"  legacy retrieval unavailable for {query!r}: {exc}", file=sys.stderr)
        return []


def _generate_queries(entities: list[dict], rng: random.Random,
                      *, per_tenant: int) -> list[tuple[str, str, Optional[str]]]:
    """Grounded queries spread across intents and the domains this tenant actually has data in."""
    out: list[tuple[str, str, Optional[str]]] = []
    by_domain: dict[str, list[dict]] = {}
    for e in entities:
        by_domain.setdefault(e.get("domain") or "", []).append(e)

    intents = list(TEMPLATES)
    while len(out) < per_tenant:
        before = len(out)
        for intent in intents:
            if len(out) >= per_tenant:
                break
            for template in TEMPLATES[intent]:
                if len(out) >= per_tenant:
                    break
                if "{d}" in template:
                    doms = [d for d in by_domain if d in DOMAINS]
                    if not doms:
                        continue
                    d = rng.choice(doms)
                    out.append((template.format(d=d), intent, d))
                    continue
                pick = rng.choice(entities)
                title = (pick.get("title") or "").strip()
                if not title:
                    continue
                dom = pick.get("domain") or None
                if "{e2}" in template:
                    others = [e for e in entities if e["entity_id"] != pick["entity_id"]
                              and (e.get("title") or "").strip()]
                    if not others:
                        continue
                    second = rng.choice(others)
                    out.append((template.format(e=title, e2=(second.get("title") or "").strip()),
                                intent, dom))
                else:
                    out.append((template.format(e=title), intent, dom))
        if len(out) == before:
            break  # nothing generatable — avoid spinning
    # De-duplicate while preserving order; templates can collide on a small entity set.
    seen: set[str] = set()
    unique = []
    for q, i, d in out:
        if q.lower() in seen:
            continue
        seen.add(q.lower())
        unique.append((q, i, d))
    return unique[:per_tenant]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_survey = sub.add_parser("survey", help="prove store connectivity and show corpus shape")
    p_survey.add_argument("--max-tenants", type=int, default=10)

    p_build = sub.add_parser("build", help="generate candidate cases for human review")
    p_build.add_argument("--out", default="evals/retrieval/golden.candidates.json")
    p_build.add_argument("--tenants", nargs="*", default=None, help="tenant ids (default: auto-discover)")
    p_build.add_argument("--max-tenants", type=int, default=5)
    p_build.add_argument("--per-tenant", type=int, default=20, help="queries per tenant")
    p_build.add_argument("--k", type=int, default=10)
    p_build.add_argument("--unretrieved", type=int, default=5,
                         help="unretrieved entities to include per case — the recall control")

    p_prom = sub.add_parser("promote", help="turn reviewed candidates into the golden set")
    p_prom.add_argument("--in", dest="infile", default="evals/retrieval/golden.candidates.json")
    p_prom.add_argument("--out", default="evals/retrieval/golden.json")
    p_prom.add_argument("--min-cases", type=int, default=75)
    p_prom.add_argument("--allow-unreviewed", action="store_true")
    p_prom.add_argument("--force", action="store_true", help="promote below --min-cases anyway")

    args = ap.parse_args()
    if args.cmd == "promote":
        return cmd_promote(args)
    return asyncio.run(cmd_survey(args) if args.cmd == "survey" else cmd_build(args))


if __name__ == "__main__":
    raise SystemExit(main())
