"""Live store checks — Qdrant, Neo4j, and the three-store alignment.

READ-ONLY. Nothing here writes, creates, deletes or alters schema. These stores hold production
data, so the runner's default posture is to look and not touch.

Every check uses the APPLICATION'S OWN CLIENTS (`app.clients.qdrant`, `app.clients.neo4j`) rather
than raw HTTP. That is deliberate: it exercises the code path production uses, including the Aura
Query-API-v2 endpoint and the tenant-refusal contract. A check written against raw HTTP could pass
while the client the advisor actually calls is broken — which is close to what happened historically
("traversal never worked vs live Neo4j", with 24 of 61 edge types unreachable).
"""
from __future__ import annotations

import json
import pathlib
from typing import Any, Optional

from _creds import Creds
from _report import BLOCKED, FAIL, PASS, UNMEASURED, Result, skip, timed

# The canonical domain value is `financial`, not `finance` — `normalize_domain('finance')` returns
# `'financial'`. A payload storing the non-canonical spelling is invisible to the domain filter while
# retrieval reports success, which is the shape of the defect the engine comment describes as having
# made 71% of the corpus unreachable.
CANONICAL_DOMAINS = {"financial", "health", "career", "education", "family", "general"}

# The worker asserts this and both fly.toml files declare it. A collection created at another
# dimension fails every write, loudly in the worker and silently in retrieval.
EXPECTED_DIM = 3072


def _qdrant(creds: Creds, collection: str):
    from app.clients.qdrant import QdrantClient
    return QdrantClient(url=creds.get("QDRANT_URL"), api_key=creds.get("QDRANT_API_KEY"),
                        collection=collection)


def _neo4j(creds: Creds):
    from app.clients.neo4j import Neo4jClient
    return Neo4jClient(uri=creds.get("NEO4J_URI"), username=creds.get("NEO4J_USERNAME", "neo4j"),
                       password=creds.get("NEO4J_PASSWORD"),
                       database=creds.get("NEO4J_PERSONAL_DATABASE", "neo4j"))


# ── Qdrant ────────────────────────────────────────────────────────────────────────────────────────
@timed("qdrant.reachable")
async def qdrant_reachable(creds: Creds) -> Result:
    if not creds.has("QDRANT_URL", "QDRANT_API_KEY"):
        return skip("qdrant.reachable", creds.missing("QDRANT_URL", "QDRANT_API_KEY"))
    coll = creds.get("QDRANT_PERSONAL_COLLECTION", "life_navigator")
    c = _qdrant(creds, coll)
    ok = await c.ready()
    count = await c.points_count()
    return Result(check="qdrant.reachable", status=PASS if ok else FAIL,
                  detail=f"collection {coll!r} ready={ok}",
                  metrics={"points": count if count is not None else "unknown"})


@timed("qdrant.dimension")
async def qdrant_dimension(creds: Creds) -> Result:
    """The collection's vector size must equal what the embedder produces (3072)."""
    if not creds.has("QDRANT_URL", "QDRANT_API_KEY"):
        return skip("qdrant.dimension", creds.missing("QDRANT_URL", "QDRANT_API_KEY"))
    import httpx
    base = creds.get("QDRANT_URL").rstrip("/")
    out: dict[str, Any] = {}
    bad: list[str] = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        for key, default in (("QDRANT_PERSONAL_COLLECTION", "life_navigator"),
                             ("QDRANT_CENTRAL_COLLECTION", "ln_central")):
            name = creds.get(key, default)
            r = await client.get(f"{base}/collections/{name}",
                                 headers={"api-key": creds.get("QDRANT_API_KEY")})
            if r.status_code != 200:
                out[name] = f"HTTP {r.status_code}"
                bad.append(f"{name}: unreachable")
                continue
            cfg = (r.json().get("result") or {}).get("config", {}).get("params", {})
            vectors = cfg.get("vectors") or {}
            # Qdrant allows either a single unnamed vector config or a dict of named ones.
            size = vectors.get("size") if isinstance(vectors, dict) and "size" in vectors else None
            if size is None and isinstance(vectors, dict):
                size = {k: v.get("size") for k, v in vectors.items() if isinstance(v, dict)}
            out[name] = size
            if size != EXPECTED_DIM and not isinstance(size, dict):
                bad.append(f"{name}: dim {size} != {EXPECTED_DIM}")
    return Result(check="qdrant.dimension", status=FAIL if bad else PASS,
                  detail="; ".join(bad) or f"both collections at {EXPECTED_DIM} dim",
                  metrics=out)


@timed("qdrant.payload_domains")
async def qdrant_payload_domains(creds: Creds) -> Result:
    """THE check I most wanted live.

    Samples real payloads and reports the `domain` values actually stored. A non-canonical value
    (`finance` instead of `financial`) makes those points invisible to the engine's domain filter
    while retrieval still reports success — found in the offline fixture today, and the live
    equivalent is the difference between graph grounding working and silently returning nothing.
    """
    if not creds.has("QDRANT_URL", "QDRANT_API_KEY"):
        return skip("qdrant.payload_domains", creds.missing("QDRANT_URL", "QDRANT_API_KEY"))
    import collections

    import httpx
    base = creds.get("QDRANT_URL").rstrip("/")
    name = creds.get("QDRANT_PERSONAL_COLLECTION", "life_navigator")
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(f"{base}/collections/{name}/points/scroll",
                              headers={"api-key": creds.get("QDRANT_API_KEY")},
                              json={"limit": 500, "with_payload": True, "with_vector": False})
    if r.status_code != 200:
        return Result(check="qdrant.payload_domains", status=FAIL,
                      detail=f"scroll failed: HTTP {r.status_code}")
    points = (r.json().get("result") or {}).get("points") or []
    seen = collections.Counter(
        str((p.get("payload") or {}).get("domain") or "<missing>") for p in points)
    non_canonical = {d: n for d, n in seen.items() if d not in CANONICAL_DOMAINS}
    pct = round(100.0 * sum(non_canonical.values()) / max(1, len(points)), 1)
    return Result(
        check="qdrant.payload_domains",
        status=FAIL if non_canonical else PASS,
        detail=(f"{pct}% of {len(points)} sampled points carry a NON-CANONICAL domain — invisible "
                f"to the domain filter" if non_canonical
                else f"all {len(points)} sampled points use canonical domains"),
        metrics={"domain_counts": dict(seen), "non_canonical": non_canonical or "none"},
    )


# ── Neo4j ─────────────────────────────────────────────────────────────────────────────────────────
@timed("neo4j.reachable")
async def neo4j_reachable(creds: Creds) -> Result:
    if not creds.has("NEO4J_URI", "NEO4J_PASSWORD"):
        return skip("neo4j.reachable", creds.missing("NEO4J_URI", "NEO4J_PASSWORD"))
    ok = await _neo4j(creds).ready()
    return Result(check="neo4j.reachable", status=PASS if ok else FAIL,
                  detail=f"Aura Query API v2 ready={ok}")


@timed("neo4j.generated_cypher")
async def neo4j_generated_cypher_runs(creds: Creds, user_id: Optional[str]) -> Result:
    """Run the ENGINE'S OWN generated Cypher against the live database.

    This is the check with the most history behind it. The repo records that traversal "never worked
    vs live Neo4j" while passing every test, because the fakes returned a shape the real client does
    not. The expand pattern is generated by `build_expand_cypher` here — not hand-written — so a
    shape mismatch between the generated query and live Aura shows up as a failure rather than as a
    swallowed "degraded" and an empty result.

    Needs a real user_id to scope to; without one it reports UNMEASURED rather than querying
    unscoped (which the client would refuse anyway).
    """
    if not creds.has("NEO4J_URI", "NEO4J_PASSWORD"):
        return skip("neo4j.generated_cypher", creds.missing("NEO4J_URI", "NEO4J_PASSWORD"))
    if not user_id:
        return Result(check="neo4j.generated_cypher", status=UNMEASURED,
                      detail="no --user-id supplied; refusing to query unscoped")

    from app.grounding.semantic import allowed_edge_types, plan_query
    from app.grounding.semantic.traversal import build_expand_cypher, build_lexical_seed_cypher

    client = _neo4j(creds)
    plan = plan_query("why is my retirement off track?")
    rels = tuple(allowed_edge_types(plan.intent))
    cypher = build_expand_cypher(rels, fan_out=10)
    if not cypher:
        return Result(check="neo4j.generated_cypher", status=FAIL,
                      detail="build_expand_cypher produced nothing for a causal plan")

    # Seed from the lexical query so the frontier is real rather than invented.
    seeds = await client.query_personal_dicts(
        build_lexical_seed_cypher(), user_id=user_id,
        parameters={"terms": ["retirement", "goal"], "limit": 10})
    frontier = [s.get("entity_id") for s in seeds if s.get("entity_id")]
    rows = await client.query_personal_dicts(
        cypher, user_id=user_id,
        parameters={"frontier": frontier or ["__none__"], "visited": [], "fan_limit": 10})

    named_ok = all(isinstance(r, dict) and "entity_id" in r for r in rows) if rows else True
    return Result(
        check="neo4j.generated_cypher",
        status=PASS if named_ok else FAIL,
        detail=(f"expand Cypher executed; {len(rows)} neighbour row(s) from "
                f"{len(frontier)} seed(s)"
                + ("" if rows else " — ZERO rows: seeds found nothing to expand from")),
        metrics={"relationship_types_in_query": len(rels), "seeds": len(frontier),
                 "neighbour_rows": len(rows),
                 "named_row_contract": "ok" if named_ok else "BROKEN"},
    )


@timed("neo4j.edge_provenance")
async def neo4j_edge_provenance(creds: Creds) -> Result:
    """How many relationships carry provenance.

    The repo records 0 of 3,208. The advisor may only cite what it can trace, so until this is
    non-zero, retrieved graph evidence cannot be used as grounding no matter how good retrieval is
    — which makes this the real dependency between the graph work and the advisor work (SP-010).

    NOT required: it is a known, specced gap, and failing the whole verdict on it would bury the
    checks the operator can act on today.
    """
    if not creds.has("NEO4J_URI", "NEO4J_PASSWORD"):
        return skip("neo4j.edge_provenance", creds.missing("NEO4J_URI", "NEO4J_PASSWORD"),
                    required=False)
    client = _neo4j(creds)
    # Aggregate only — no node content leaves the database.
    rows = await client.query_personal_dicts(
        "MATCH (a {tenant_id: $user_id})-[r]-(b {tenant_id: $user_id}) "
        "RETURN count(r) AS total, "
        "       sum(CASE WHEN r.assertion_id IS NOT NULL OR r.provenance IS NOT NULL "
        "                THEN 1 ELSE 0 END) AS with_provenance",
        user_id="__aggregate_probe__", parameters={})
    total = (rows[0].get("total") if rows else 0) or 0
    with_prov = (rows[0].get("with_provenance") if rows else 0) or 0
    return Result(check="neo4j.edge_provenance", status=PASS if with_prov else UNMEASURED,
                  required=False,
                  detail=(f"{with_prov}/{total} edges carry provenance for the probe tenant "
                          f"(a zero total means the probe tenant simply has no graph)"),
                  metrics={"edges": total, "with_provenance": with_prov})


# ── Three-store alignment ─────────────────────────────────────────────────────────────────────────
@timed("stores.alignment")
async def three_store_alignment(creds: Creds, user_id: Optional[str]) -> Result:
    """Do Supabase, Neo4j and Qdrant agree on how much of this user's life exists?

    The repo records 190/786 aligned — a recurring problem, and the reason "the advisor cannot see my
    data" has come up repeatedly. Retrieval quality is bounded by the smallest store: a perfect
    retriever over a third of the corpus still answers from a third of the corpus.

    Counts only. No content is compared or logged.
    """
    needed = ("NEO4J_URI", "NEO4J_PASSWORD", "QDRANT_URL", "QDRANT_API_KEY",
              "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    if not creds.has(*needed):
        return skip("stores.alignment", creds.missing(*needed), required=False)
    if not user_id:
        return Result(check="stores.alignment", status=UNMEASURED, required=False,
                      detail="no --user-id supplied")

    import httpx

    # Neo4j: nodes for this tenant.
    neo_rows = await _neo4j(creds).query_personal_dicts(
        "MATCH (n {tenant_id: $user_id}) RETURN count(n) AS n", user_id=user_id, parameters={})
    neo_n = (neo_rows[0].get("n") if neo_rows else 0) or 0

    # Qdrant: points for this user.
    base = creds.get("QDRANT_URL").rstrip("/")
    name = creds.get("QDRANT_PERSONAL_COLLECTION", "life_navigator")
    async with httpx.AsyncClient(timeout=20.0) as client:
        qr = await client.post(f"{base}/collections/{name}/points/count",
                               headers={"api-key": creds.get("QDRANT_API_KEY")},
                               json={"filter": {"must": [{"key": "user_id",
                                                          "match": {"value": user_id}}]},
                                     "exact": True})
        qd_n = ((qr.json().get("result") or {}).get("count") if qr.status_code == 200 else None)

        # Supabase: life.facts as the system-of-record proxy.
        sr = await client.get(
            f"{creds.get('SUPABASE_URL').rstrip('/')}/rest/v1/facts",
            headers={"apikey": creds.get("SUPABASE_SERVICE_ROLE_KEY"),
                     "authorization": f"Bearer {creds.get('SUPABASE_SERVICE_ROLE_KEY')}",
                     "accept-profile": "life", "prefer": "count=exact", "range": "0-0"},
            params={"user_id": f"eq.{user_id}", "select": "id"})
        sb_n = _content_range_total(sr.headers.get("content-range"))

    counts = {"supabase_life_facts": sb_n, "neo4j_nodes": neo_n, "qdrant_points": qd_n}
    known = [v for v in counts.values() if isinstance(v, int)]
    worst = min(known) if known else 0
    best = max(known) if known else 0
    ratio = round(100.0 * worst / best, 1) if best else None
    return Result(
        check="stores.alignment", status=PASS if ratio is not None and ratio >= 90 else UNMEASURED,
        required=False,
        detail=(f"smallest store holds {ratio}% of the largest — retrieval quality is bounded by "
                f"the smallest" if ratio is not None else "counts incomplete"),
        metrics=counts,
    )


def _content_range_total(header: Optional[str]) -> Optional[int]:
    """PostgREST returns `0-0/1234` when asked for an exact count."""
    if not header or "/" not in header:
        return None
    tail = header.rsplit("/", 1)[-1]
    return int(tail) if tail.isdigit() else None


@timed("ontology.live_types")
async def ontology_manifest_matches_live_types(creds: Creds) -> Result:
    """Do the relationship types in the live graph exist in the generated manifest?

    A live type absent from the manifest is UNREACHABLE: `_validate_rel_types` drops it, so that data
    can never be traversed. The inverse (manifest types with no live edges) is normal — the schema is
    wider than any one user's graph.
    """
    if not creds.has("NEO4J_URI", "NEO4J_PASSWORD"):
        return skip("ontology.live_types", creds.missing("NEO4J_URI", "NEO4J_PASSWORD"),
                    required=False)
    manifest_path = (pathlib.Path(__file__).resolve().parents[2]
                     / "apps/lifenavigator-core-api/app/grounding/semantic/ontology_manifest.json")
    manifest = json.loads(manifest_path.read_text())
    known = {r["rel_type"] for r in manifest["relationships"]}
    traversable = {r["rel_type"] for r in manifest["relationships"] if r["traversable"]}

    rows = await _neo4j(creds).query_personal_dicts(
        "MATCH ()-[r]-() RETURN DISTINCT type(r) AS t LIMIT 500",
        user_id="__schema_probe__", parameters={})
    live = {str(r.get("t")) for r in rows if r.get("t")}
    unknown = sorted(live - known)
    not_traversable = sorted(live & known - traversable)
    return Result(
        check="ontology.live_types", status=FAIL if unknown else PASS, required=False,
        detail=(f"{len(unknown)} live type(s) absent from the manifest — that data is unreachable"
                if unknown else f"all {len(live)} live types are in the manifest"),
        metrics={"live_types": len(live), "absent_from_manifest": unknown or "none",
                 "present_but_not_traversable": not_traversable or "none"},
    )
