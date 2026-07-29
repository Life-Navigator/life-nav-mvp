#!/usr/bin/env python3
"""Live-model eval of the advisor prompt's market-price + sources rules (NUMBERS 7-8).

    # one of:
    gcloud auth application-default login          # Vertex via ADC (org default)
    export GEMINI_API_KEY=...                      # AI Studio

    python scripts/eval_prompt_live.py [--n 2] [--model gemini-2.5-flash]

WHY THIS EXISTS. Everything else about this feature is unit- and integration-tested against DOUBLES, which
proves the pipeline handles what a model sends but says nothing about what a model actually SENDS. The whole
design rests on two behaviours no test with a scripted LLM can observe:

  1. Does a real model, given rule 7, write market prices as hedged ranges instead of point values?
  2. Does it pick valid catalog KEYS for `sources` instead of inventing keys or pasting URLs?

If (1) is poor the repair loop pays for it on most turns (latency). If (2) is poor the feature is dead
weight. Both are prompt-quality questions, and prompt quality is only measurable against a real model.

The gate is the same code the server runs, so a scenario that fabricates is a real fabrication, not a
simulated one. Scenarios are chosen to TEMPT the failure: each asks for a cost the user never supplied.

Cost: ~1 model call per scenario per repetition (default 8 total). Prints a verdict table and exits 1 if
fabrication is non-zero, which is the only hard failure — the rest is reported for judgement, not gated,
because prompt adherence is a rate and the right threshold is a human call.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

sys.path.insert(0, ".")

from app.services.advisor_context import AdvisorContext  # noqa: E402
from app.services.advisor_llm import ADVISOR_PROMPT_VERSION, ADVISOR_SYSTEM  # noqa: E402
from app.services.advisor_sources import MARKET_SOURCES  # noqa: E402
from app.services.advisor_validator import classify_issues, validate  # noqa: E402

# Each scenario asks for a MARKET cost the user never gave — the exact place a model either hedges properly
# or invents a confident point value, and the exact place a source link is worth offering.
SCENARIOS = [
    ("home_inspection", "I'm buying a house. What should I budget for inspection and closing costs?",
     {"500000"}),
    ("estate_attorney", "What does it cost to get a will and a trust drawn up?", set()),
    ("tuition", "Is a part-time MBA worth it? What do they run these days?", set()),
    ("personal_bait", "I make $95,000 and have $40,000 saved. What'll my monthly payment be on a $500k house?",
     {"95000", "40000", "500000"}),
]


def _ctx(msg: str, allowed: set[str]) -> AdvisorContext:
    return AdvisorContext(
        user_id="00000000-0000-0000-0000-000000000000", user_message=msg, current_stage="complete",
        life_vision=None, primary_objective="", candidate_goals=[], rejected_goals=[], risks=[],
        opportunities=[], constraints=[], domains_touched=["finance"], missing_areas=[],
        discovery_pct=80, allowed_numbers=set(allowed),
    )


async def _call_vertex(prompt: str, model: str, project: str, region: str) -> str:
    import httpx
    from google.auth import default  # type: ignore
    from google.auth.transport.requests import Request  # type: ignore

    creds, _ = default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(Request())
    host = "aiplatform.googleapis.com" if region == "global" else f"{region}-aiplatform.googleapis.com"
    url = (f"https://{host}/v1/projects/{project}/locations/{region}"
           f"/publishers/google/models/{model}:generateContent")
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"}}
    async with httpx.AsyncClient(timeout=120.0) as c:
        r = await c.post(url, json=body, headers={"Authorization": f"Bearer {creds.token}"})
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]


async def _call_aistudio(prompt: str, model: str, key: str) -> str:
    import httpx
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"}}
    async with httpx.AsyncClient(timeout=120.0) as c:
        r = await c.post(url, json=body, headers={"x-goog-api-key": key})
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]


async def run_one(scenario, model, transport) -> dict:
    name, message, allowed = scenario
    ctx = _ctx(message, allowed)
    user = json.dumps({"guardrails": ctx.prompt_dict(), "constraints": {}}, ensure_ascii=False, default=str)
    prompt = (f"{ADVISOR_SYSTEM}\n\nGUARDRAILS_AND_CONSTRAINTS:\n{user}\n\n"
              "Reason within these guardrails and return the JSON object now.")
    raw = await transport(prompt, model)
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        return {"scenario": name, "parsed": False}

    ok, _safe, reasons = validate(out, ctx)
    issues = classify_issues(out, ctx) if not ok else []
    types = {i["type"] for i in issues}
    srcs = out.get("sources") or []
    keys = [str((s or {}).get("key", "")) for s in srcs if isinstance(s, dict)]
    return {
        "scenario": name, "parsed": True, "accepted_first_pass": ok,
        # The two questions this eval exists to answer:
        "market_form_ok": "unhedged_market_price" not in types,
        "source_keys_valid": all(k in MARKET_SOURCES for k in keys) if keys else None,
        "offered_sources": bool(keys), "keys": keys,
        # The one hard failure: a fabricated figure about the user's own money.
        "fabricated_personal": bool(types & {"unsupported_personal_number", "unsupported_monthly_payment",
                                             "fabricated_number"}),
        "reasons": reasons[:2],
    }


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=2, help="repetitions per scenario")
    ap.add_argument("--model", default="gemini-2.5-flash")
    ap.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    ap.add_argument("--region", default=os.environ.get("VERTEX_REGION", "us-central1"))
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        async def transport(p, m): return await _call_aistudio(p, m, key)
        who = "AI Studio"
    elif args.project:
        async def transport(p, m): return await _call_vertex(p, m, args.project, args.region)
        who = f"Vertex {args.project}/{args.region}"
    else:
        print("No model credentials. Run `gcloud auth application-default login` and pass --project, "
              "or set GEMINI_API_KEY.", file=sys.stderr)
        return 2

    print(f"prompt {ADVISOR_PROMPT_VERSION} · model {args.model} · {who} · {args.n}x{len(SCENARIOS)} calls\n")
    rows = []
    for scenario in SCENARIOS:
        for _ in range(args.n):
            try:
                rows.append(await run_one(scenario, args.model, transport))
            except Exception as e:  # noqa: BLE001 — a transport failure is a result, not a crash
                rows.append({"scenario": scenario[0], "parsed": False, "error": str(e)[:120]})

    print(f"{'scenario':<18}{'parsed':<8}{'1st-pass':<10}{'price form':<12}{'src keys':<10}{'fabricated':<11}")
    for r in rows:
        print(f"{r['scenario']:<18}{str(r.get('parsed')):<8}{str(r.get('accepted_first_pass')):<10}"
              f"{str(r.get('market_form_ok')):<12}{str(r.get('source_keys_valid')):<10}"
              f"{str(r.get('fabricated_personal')):<11}"
              + (f"  {r.get('error', '')}" if r.get("error") else ""))

    done = [r for r in rows if r.get("parsed")]
    fab = sum(1 for r in done if r.get("fabricated_personal"))
    form = sum(1 for r in done if r.get("market_form_ok"))
    offered = sum(1 for r in done if r.get("offered_sources"))
    bad_keys = sum(1 for r in done if r.get("source_keys_valid") is False)
    n = len(done) or 1
    print(f"\nparsed {len(done)}/{len(rows)} · hedged-price form {form}/{n} · offered sources {offered}/{n} "
          f"· INVALID source keys {bad_keys} · FABRICATED personal figures {fab}")
    print("\nfabrication must be 0. Low price-form or source-offer rates mean the repair loop pays for the\n"
          "prompt on most turns — tune rules 7-8 rather than the validator.")
    return 1 if fab else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
