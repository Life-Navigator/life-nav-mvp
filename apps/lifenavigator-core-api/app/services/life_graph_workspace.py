"""Life Graph Workspace (Explainable 3D Graph sprint).

Adapts the user's REAL persisted life graph (`LifeDiscoveryService.personal_graph()`) into the frontend
`LifeGraphWorkspace` contract. It invents NOTHING: every node is a real persisted record and every edge is
backed by a real persisted edge or a real computed connection (shared node), carrying its provenance and a
citation. This reuses the SAME relation core as the Hybrid Advisor (`derive_graph_relations`), so the graph
and the advisor agree on what relationships exist — if the advisor cannot cite an edge, the graph cannot
draw it.

query-focus relevance is computed server-side from real semantic embeddings of the actual node text — not
guessed on the frontend. No embeddings / no graph → empty focus (the UI simply doesn't highlight).
"""
from __future__ import annotations

import asyncio
import math
from typing import Any, Optional

from .advisor_context import derive_graph_relations

# personal_graph node type  →  contract GraphNodeType (frontend colours by DOMAIN, labels by type)
_TYPE_MAP = {
    "Life Vision": "goal",
    "Life Objective": "goal",
    "Goal": "goal",
    "Risk": "risk",
    "Opportunity": "opportunity",
    "Constraint": "risk",
    "Dependency": "source",
}
# Domain hubs (Family/Career/Education/Health/...) → "domain"; everything else (domain entities) → "source".
_HUB_TYPES = {"Family", "Career", "Education", "Health", "Finance", "Estate", "Insurance"}

_IMPORTANCE = {
    "Life Vision": 1.0, "Life Objective": 0.9, "Goal": 0.6,
    "Risk": 0.5, "Opportunity": 0.5, "Constraint": 0.5, "Dependency": 0.4,
}
_VALID_DOMAINS = {"finance", "career", "education", "health", "family", "estate", "insurance", "general"}
_MAX_FOCUS_NODES = 120  # bound the per-query embedding cost; beyond this we honestly return no focus
_PRIORITY_IMPORTANCE = {"high": 0.85, "medium": 0.6, "low": 0.4}


def _contract_type(node: dict[str, Any]) -> str:
    t = node.get("type") or ""
    if str(node.get("id") or "").endswith("_hub") or t in _HUB_TYPES:
        return "domain"
    return _TYPE_MAP.get(t, "source")


def _domain(node: dict[str, Any]) -> str:
    d = str(node.get("domain") or "").lower()
    return d if d in _VALID_DOMAINS else "general"


def _importance(node: dict[str, Any]) -> float:
    if str(node.get("id") or "").endswith("_hub"):
        return 0.7
    return _IMPORTANCE.get(node.get("type") or "", 0.3)


def _map_node(node: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": node["id"],
        "label": str(node.get("label") or node.get("id")),
        "type": _contract_type(node),
        "domain": _domain(node),
        "score": None,
        "confidence": node.get("confidence"),
        "importance": _importance(node),
        "description": None,
        "lastUpdated": node.get("updated_at"),
    }
    # Real lineage: a domain-entity node points back at the exact source row it came from.
    if node.get("table") and node.get("record_id"):
        out["dataUsed"] = [{
            "id": str(node.get("record_id")),
            "label": str(node.get("type") or "Record"),
            "value": str(node.get("label") or ""),
            "sourceTable": node.get("table"),
            "sourceId": node.get("record_id"),
            "confidence": node.get("confidence"),
            "lastUpdated": node.get("updated_at"),
        }]
    return out


def _rec_domain(rec: dict[str, Any]) -> str:
    for d in [*(rec.get("impacted_domains") or []), rec.get("category")]:
        ds = str(d or "").lower()
        if ds in _VALID_DOMAINS and ds != "general":
            return ds
    return "general"


def recommendation_lineage(recommendations: Any, base_node_ids: set[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """REAL recommendation → evidence → source lineage from RecommendationOS rows. Every node/edge is
    backed by stored recommendation data; nothing is inferred. recommendation→domain-hub edges are drawn
    ONLY from a recommendation's own declared impacted_domains AND only when that hub node already exists.
    Recommendations carry no objective/goal id, so we never fabricate a rec→specific-goal edge.
    """
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    src_seen: dict[str, dict[str, Any]] = {}
    for rec in recommendations or []:
        rid = rec.get("id")
        if not rid:
            continue
        rnode = f"rec:{rid}"
        domain = _rec_domain(rec)
        impacted = [str(d) for d in (rec.get("impacted_domains") or [])]
        evidence = [e for e in (rec.get("evidence") or []) if isinstance(e, dict)]
        ev_ids = [f"ev:{rid}:{i}" for i in range(len(evidence))]
        assumptions = [
            {"id": f"{rnode}:a{i}", "label": str(a.get("label") or ""), "value": str(a.get("value") or "")}
            for i, a in enumerate(rec.get("assumptions") or []) if isinstance(a, dict)
        ]
        unlocked = ((rec.get("quantified_impact") or {}).get("unlocked_capabilities")) or []
        missing = [{"id": f"{rnode}:m{i}", "label": str(c), "value": "Unlocked once this is addressed"}
                   for i, c in enumerate(unlocked)]
        formula = rec.get("formula") or {}
        wf = [{"id": f"{rnode}:f:{k}", "label": k.replace("_", " "), "weight": float(formula[k]),
               "impact": "positive" if k in ("impact", "urgency", "evidence_strength") else "neutral"}
              for k in ("impact", "confidence", "urgency", "evidence_strength", "effort")
              if isinstance(formula.get(k), (int, float))]
        narrative = rec.get("narrative") or {}
        nodes.append({
            "id": rnode, "label": str(rec.get("title") or "Recommendation"), "type": "recommendation",
            "domain": domain, "score": rec.get("rank_score"), "confidence": rec.get("confidence"),
            "importance": _PRIORITY_IMPORTANCE.get(str(rec.get("priority") or "").lower(), 0.6),
            "description": rec.get("description") or narrative.get("why"), "lastUpdated": rec.get("updated_at"),
            "impactedDomains": impacted, "evidenceIds": ev_ids, "assumptions": assumptions, "missingData": missing,
            "dataUsed": [{"id": f"{rnode}:src{i}", "label": str(e.get("source_table") or "source"),
                          "value": str(e.get("statement") or ""), "sourceTable": e.get("source_table"),
                          "confidence": rec.get("confidence")} for i, e in enumerate(evidence)],
            "xai": {"reasoningSummary": narrative.get("why") or rec.get("description"),
                    "formula": formula.get("formula"), "weightedFactors": wf},
        })
        for i, e in enumerate(evidence):
            ev_id, st = ev_ids[i], e.get("source_table")
            nodes.append({"id": ev_id, "label": str(e.get("statement") or "evidence")[:90], "type": "evidence",
                          "domain": domain, "confidence": rec.get("confidence"), "importance": 0.35,
                          "description": str(e.get("statement") or ""),
                          "dataUsed": ([{"id": f"{ev_id}:src", "label": str(st), "sourceTable": st}] if st else [])})
            conf = rec.get("confidence")
            edges.append({"id": f"rec_ev:{rid}:{i}", "source": rnode, "target": ev_id, "label": "evidenced by",
                          "type": "evidenced_by", "strength": conf if conf is not None else 0.6, "confidence": conf,
                          "provenance": "persisted_edge", "via": None, "viaId": None, "citationId": ev_id,
                          "evidenceIds": [ev_id]})
            if st:
                sid = f"src:{st}"
                src_seen.setdefault(sid, {"id": sid, "label": str(st), "type": "source", "domain": "general",
                                          "importance": 0.3, "description": f"Source table: {st}"})
                edges.append({"id": f"ev_src:{rid}:{i}", "source": ev_id, "target": sid, "label": "from source",
                              "type": "from_source", "strength": 0.5, "confidence": None,
                              "provenance": "persisted_edge", "via": None, "viaId": None, "citationId": sid,
                              "evidenceIds": []})
        for d in impacted:
            hub = f"{str(d).lower()}_hub"
            if hub in base_node_ids:
                edges.append({"id": f"rec_hub:{rid}:{d}", "source": rnode, "target": hub, "label": "impacts",
                              "type": "impacts", "strength": 0.5, "confidence": rec.get("confidence"),
                              "provenance": "computed_connection", "via": str(d), "viaId": hub,
                              "citationId": rnode, "evidenceIds": []})
    nodes.extend(src_seen.values())
    return nodes, edges


def build_workspace(graph: dict[str, Any], recommendations: Any = None) -> dict[str, Any]:
    """Pure mapping: a real personal_graph dict (+ real RecommendationOS rows) → LifeGraphWorkspace.
    Empty graph + no recommendations → empty workspace."""
    by_id, id_edges, id_connections = derive_graph_relations(graph or {})
    nodes = [_map_node(by_id[nid]) for nid in by_id]

    def label(nid: Optional[str]) -> str:
        return str((by_id.get(nid) or {}).get("label") or nid)

    edges: list[dict[str, Any]] = []
    # 1) Persisted edges — the ground truth.
    for e in id_edges:
        conf = e.get("confidence")
        edges.append({
            "id": f"persisted:{e['source']}->{e['target']}:{e.get('rel') or 'rel'}",
            "source": e["source"], "target": e["target"],
            "label": e.get("rel"), "type": e.get("rel"),
            "strength": conf if conf is not None else 0.5,
            "confidence": conf,
            "provenance": "persisted_edge",
            "via": None, "viaId": None, "citationId": None,
            "evidenceIds": [],
        })
    # 2) Computed connections via a shared node (direct-edge primary links are already persisted above).
    for c in id_connections:
        if c.get("basis") != "shared_node" or not c.get("via"):
            continue
        via = c["via"]
        edges.append({
            "id": f"computed:{c['source']}->{c['target']}:via:{via}",
            "source": c["source"], "target": c["target"],
            "label": f"related via {label(via)}", "type": "computed_connection",
            "strength": 0.4, "confidence": 0.4,
            "provenance": "shared_node",
            "via": label(via), "viaId": via, "citationId": via,
            "evidenceIds": [via],
        })

    # 3) Recommendation → evidence → source lineage (+ impacted-domain hub edges) — all from real rows.
    rec_nodes, rec_edges = recommendation_lineage(recommendations, set(by_id.keys()))
    nodes.extend(rec_nodes)
    edges.extend(rec_edges)

    confidences = [n["confidence"] for n in nodes if isinstance(n.get("confidence"), (int, float))]
    strengths = [e["strength"] for e in edges if isinstance(e.get("strength"), (int, float))]
    updated = [by_id[nid].get("updated_at") for nid in by_id if by_id[nid].get("updated_at")]
    metrics = {
        "totalNodes": len(nodes),
        "totalEdges": len(edges),
        "avgConfidence": round(sum(confidences) / len(confidences), 3) if confidences else None,
        "avgStrength": round(sum(strengths) / len(strengths), 3) if strengths else None,
        "lastUpdated": max(updated) if updated else None,
    }
    return {"nodes": nodes, "edges": edges, "metrics": metrics}


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _node_text(node: dict[str, Any]) -> str:
    parts = [str(node.get("label") or ""), str(node.get("type") or ""), str(node.get("domain") or "")]
    return " · ".join(p for p in parts if p).strip()


async def query_focus(gemini: Any, graph: dict[str, Any], query: str) -> dict[str, float]:
    """REAL semantic relevance: embed the query + each node's text with the same embedding model and score
    by cosine, normalised to the strongest match. No graph / no embeddings / any error → {} (no focus)."""
    q = (query or "").strip()
    nodes = (graph or {}).get("nodes") or []
    if not q or not nodes or gemini is None or not getattr(gemini, "configured", False):
        return {}
    if len(nodes) > _MAX_FOCUS_NODES:
        nodes = sorted(nodes, key=lambda n: -(n.get("confidence") or 0))[:_MAX_FOCUS_NODES]
    try:
        texts = [_node_text(n) for n in nodes]
        qvec, *node_vecs = await asyncio.gather(
            gemini.embed(q), *[gemini.embed(t or n.get("id") or "node") for t, n in zip(texts, nodes)]
        )
    except Exception:  # noqa: BLE001 — any embedding failure → no focus rather than a guess
        return {}
    sims = [max(0.0, _cosine(qvec, v)) for v in node_vecs]
    top = max(sims) if sims else 0.0
    if top <= 0:
        return {}
    out: dict[str, float] = {}
    for node, sim in zip(nodes, sims):
        rel = round(sim / top, 3)  # normalise so the strongest match ≈ 1.0
        if rel > 0.15:  # ignore weak noise so the focus stays meaningful
            out[node["id"]] = rel
    return out
