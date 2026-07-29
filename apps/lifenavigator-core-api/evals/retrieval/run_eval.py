#!/usr/bin/env python3
"""Retrieval evaluation — measures the semantic engine against the legacy retriever.

    python evals/retrieval/run_eval.py --golden evals/retrieval/golden.json

WHY THIS SHIPS WITH THE ENGINE, NOT AFTER IT
--------------------------------------------
The project's own benchmark already established that architecture contributed 0% of the measured advisor
gap. Shipping a "better" retriever with no way to prove it is better is how that credibility gap was
created. This runner exists so the claim "the semantic engine improves retrieval" is a number, not an
assertion — and so a regression is caught by CI rather than by a user.

WHAT IT MEASURES
    recall@k · precision@k · MRR · nDCG@k     for BOTH implementations on identical inputs
    per-channel attribution                    (vector / graph / central) — is the graph earning its cost?
    traversal cost                             nodes visited, hops, truncation rate, latency

PRODUCTION-PATH RULE
--------------------
The runner drives `SemanticGraphRAG.retrieve(...)` — the exact call `AdvisorContextBuilder` makes — with a
real tenant id. It does NOT reach into `traverse()` or `fuse()` directly. Measuring a path no user reaches
is how you get a green eval and an unchanged product.

GOLDEN SET FORMAT (evals/retrieval/golden.json)
    [{"query": "...", "user_id": "...", "domain": "finance|null",
      "relevant": ["entity_id", ...],          # human-labelled
      "notes": "why these are the right answers"}]

Real store credentials are required — this measures live retrieval. With none configured it prints the
metric table shape against an empty corpus so the harness itself stays testable.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.clients.gemini import GeminiClient          # noqa: E402
from app.clients.neo4j import Neo4jClient            # noqa: E402
from app.clients.qdrant import QdrantClient          # noqa: E402
from app.config import get_settings                  # noqa: E402
from app.grounding.semantic import SemanticGraphRAG  # noqa: E402


@dataclass
class Metrics:
    n: int = 0
    recall_at_k: float = 0.0
    precision_at_k: float = 0.0
    mrr: float = 0.0
    ndcg_at_k: float = 0.0
    channel_counts: dict[str, int] = field(default_factory=dict)
    nodes_visited: int = 0
    hops: int = 0
    truncated: int = 0
    latency_ms: int = 0

    def row(self, label: str, k: int) -> str:
        return (f"{label:<22}{self.recall_at_k:>9.3f}{self.precision_at_k:>11.3f}"
                f"{self.mrr:>7.3f}{self.ndcg_at_k:>9.3f}{self.latency_ms // max(1, self.n):>9d}ms")


def _dcg(gains: list[float]) -> float:
    return sum(g / math.log2(i + 2) for i, g in enumerate(gains))


def _score(retrieved: list[str], relevant: set[str], k: int) -> tuple[float, float, float, float]:
    top = retrieved[:k]
    hits = [1.0 if e in relevant else 0.0 for e in top]
    recall = (sum(hits) / len(relevant)) if relevant else 0.0
    precision = (sum(hits) / len(top)) if top else 0.0
    rr = next((1.0 / (i + 1) for i, h in enumerate(hits) if h), 0.0)
    ideal = _dcg([1.0] * min(len(relevant), k))
    ndcg = (_dcg(hits) / ideal) if ideal else 0.0
    return recall, precision, rr, ndcg


async def _eval_semantic(engine: SemanticGraphRAG, cases: list[dict], k: int) -> Metrics:
    m = Metrics()
    for case in cases:
        # THE PRODUCTION CALL — identical to AdvisorContextBuilder's.
        evidence, trace = await engine.retrieve(
            case["query"], user_id=case["user_id"], domain=case.get("domain"), limit=k,
        )
        ids = [e["entity_id"] for e in evidence]
        r, p, rr, nd = _score(ids, set(case.get("relevant") or []), k)
        m.n += 1
        m.recall_at_k += r; m.precision_at_k += p; m.mrr += rr; m.ndcg_at_k += nd
        m.nodes_visited += trace.nodes_visited
        m.hops += trace.hops_executed
        m.truncated += int(trace.truncated)
        m.latency_ms += trace.latency_ms
        for e in evidence:
            for ch in str(e.get("source", "")).split("+"):
                if ch:
                    m.channel_counts[ch] = m.channel_counts.get(ch, 0) + 1
    if m.n:
        m.recall_at_k /= m.n; m.precision_at_k /= m.n; m.mrr /= m.n; m.ndcg_at_k /= m.n
    return m


async def _eval_legacy(cases: list[dict], k: int) -> Metrics:
    """The flat retriever, for the A/B that justifies (or refutes) the new engine."""
    from app.grounding.retriever import Retriever
    from app.models.common import UserContext

    s = get_settings()
    legacy = Retriever(gemini=GeminiClient.from_settings(s),
                       qdrant=QdrantClient.from_settings(s),
                       neo4j=Neo4jClient.from_settings(s))
    m = Metrics()
    for case in cases:
        ev = await legacy.retrieve_personal(
            case["query"], UserContext(user_id=case["user_id"]),
            domain=case.get("domain"), limit=k,
        ) or []
        ids = [str(e.get("entity_id")) for e in ev if e.get("entity_id")]
        r, p, rr, nd = _score(ids, set(case.get("relevant") or []), k)
        m.n += 1
        m.recall_at_k += r; m.precision_at_k += p; m.mrr += rr; m.ndcg_at_k += nd
    if m.n:
        m.recall_at_k /= m.n; m.precision_at_k /= m.n; m.mrr /= m.n; m.ndcg_at_k /= m.n
    return m


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", default="evals/retrieval/golden.json")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--skip-legacy", action="store_true")
    args = ap.parse_args()

    path = Path(args.golden)
    if not path.exists():
        print(f"No golden set at {path}.\n"
              f"Create it with 75-100 labelled queries — see the module docstring for the schema.\n"
              f"Until it exists, no claim about retrieval quality is measurable.", file=sys.stderr)
        return 2
    cases = json.loads(path.read_text())
    if not cases:
        print("Golden set is empty.", file=sys.stderr)
        return 2

    s = get_settings()
    engine = SemanticGraphRAG(
        gemini=GeminiClient.from_settings(s),
        qdrant=QdrantClient.from_settings(s),
        neo4j=Neo4jClient.from_settings(s),
        central_qdrant=QdrantClient.central_from_settings(s),
    )
    if not engine.available:
        print("WARNING: stores not configured — metrics will be zero. Set QDRANT_*/NEO4J_*/GEMINI_*.",
              file=sys.stderr)

    print(f"\nretrieval eval · {len(cases)} queries · k={args.k}\n")
    print(f"{'implementation':<22}{'recall@k':>9}{'precision@k':>11}{'MRR':>7}{'nDCG@k':>9}{'latency':>11}")
    print("-" * 69)

    sem = await _eval_semantic(engine, cases, args.k)
    print(sem.row("semantic (v2)", args.k))

    leg = None
    if not args.skip_legacy:
        try:
            leg = await _eval_legacy(cases, args.k)
            print(leg.row("legacy flat (v1)", args.k))
        except Exception as exc:  # noqa: BLE001
            print(f"legacy eval skipped: {exc}", file=sys.stderr)

    print("\nchannel attribution (is the graph earning its cost?)")
    total = sum(sem.channel_counts.values()) or 1
    for ch, n in sorted(sem.channel_counts.items(), key=lambda x: -x[1]):
        print(f"  {ch:<10} {n:>5}  {100.0 * n / total:>5.1f}%")

    print(f"\ntraversal cost: avg {sem.nodes_visited / max(1, sem.n):.1f} nodes · "
          f"avg {sem.hops / max(1, sem.n):.2f} hops · truncated {sem.truncated}/{sem.n}")

    if leg is not None:
        d_ndcg = sem.ndcg_at_k - leg.ndcg_at_k
        d_recall = sem.recall_at_k - leg.recall_at_k
        print(f"\nDELTA vs legacy:  nDCG@{args.k} {d_ndcg:+.3f}   recall@{args.k} {d_recall:+.3f}")
        if d_ndcg <= 0:
            print("\n  The semantic engine did NOT beat the flat retriever on this set.\n"
                  "  That is a result, not a failure of the harness — report it and either fix the\n"
                  "  engine or drop the claim. Do not enable v2 in production on this evidence.")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
