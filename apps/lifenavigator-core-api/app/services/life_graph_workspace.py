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
_MAX_FOCUS_NODES = 80  # bound the per-query embedding cost; beyond this we honestly return no focus


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


def build_workspace(graph: dict[str, Any]) -> dict[str, Any]:
    """Pure mapping: a real personal_graph dict → LifeGraphWorkspace. Empty graph → empty workspace."""
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
