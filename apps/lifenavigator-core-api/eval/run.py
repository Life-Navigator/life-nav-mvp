"""Harness entry point.

    python -m eval.run                          # gate + routing + retrieval_synthetic — what CI runs
    python -m eval.run --probe gate              # one probe
    python -m eval.run --save-baseline           # freeze current state as the comparison point
    python -m eval.run --json out.json           # machine-readable, for artifact upload
    python -m eval.run --probe retrieval          # needs Neo4j+Qdrant; UNMEASURED without labels

EXIT CODES
    0  no regression against baseline (including UNMEASURED — nothing checked is not a failure)
    1  a rate regressed, or a baseline is incomparable
Nothing here touches production: it imports the services and calls them with fixtures.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any

from . import probe_gate, probe_retrieval, probe_routing
from .scorecard import ProbeScore, compare, render, save_baseline

# Probes that need no model, no stores and no credentials. These are the CI set — everything else is
# on demand, because an eval you cannot afford to run on every PR is an eval that runs once.
OFFLINE = ("gate", "routing", "retrieval_synthetic")
ALL = OFFLINE + ("retrieval",)


def _run_probe(name: str) -> ProbeScore:
    if name == "gate":
        return probe_gate.run()
    if name == "routing":
        return probe_routing.run()
    if name == "retrieval_synthetic":
        # Retrieval BEHAVIOUR over the declared graph in eval/fixtures/graph_world.json. Needs no
        # model, no stores and no credentials, so it belongs in the CI set — unlike `retrieval`,
        # which needs live Neo4j+Qdrant and human relevance labels.
        return asyncio.run(probe_retrieval.run_synthetic())
    if name == "retrieval":
        # No retriever is constructed here. Building one needs Neo4j + Qdrant credentials and
        # GRAPH_GROUNDING_ENABLED; the probe reports UNMEASURED rather than inventing a result, which
        # is the honest state until the relevance labels exist.
        return asyncio.run(probe_retrieval.run(retriever=None))
    raise SystemExit(f"unknown probe {name!r}; choose from {', '.join(ALL)}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="eval.run", description="Advisor evaluation harness")
    ap.add_argument("--probe", action="append", choices=list(ALL),
                    help="probe to run (repeatable). Default: the offline set.")
    ap.add_argument("--save-baseline", action="store_true",
                    help="freeze this run as the baseline future runs are compared against")
    ap.add_argument("--json", metavar="PATH", help="write the full scorecard as JSON")
    args = ap.parse_args(argv)

    names = args.probe or list(OFFLINE)
    scores = [_run_probe(n) for n in names]
    verdicts = [compare(s) for s in scores]

    print(render(scores, verdicts))

    if args.save_baseline:
        print()
        for s in scores:
            # Refuse to freeze a baseline from a probe that measured nothing: it would look like a
            # gate while asserting nothing, which is worse than having no baseline at all.
            if not s.measured:
                print(f"   skipped baseline for {s.probe}: nothing was measured")
                continue
            print(f"   baseline written: {save_baseline(s)}")

    if args.json:
        payload: dict[str, Any] = {"probes": [s.as_dict() for s in scores]}
        with open(args.json, "w") as fh:
            json.dump(payload, fh, indent=2, sort_keys=True)
        print(f"   json written: {args.json}")

    return 0 if all(v.ok for v in verdicts) else 1


if __name__ == "__main__":
    sys.exit(main())
