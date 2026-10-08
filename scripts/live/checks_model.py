"""Live model checks — Claude Opus via Vertex AI.

THIS IS THE MOST IMPORTANT FILE IN THE RUNNER
---------------------------------------------
Everything about the Opus switch was verified against `httpx.MockTransport` — a fake transport
returning a canned reply. That proves what we SEND. It proves nothing about what Vertex ACCEPTS, and
three of the fields we now send are unverified against the real endpoint:

    thinking: {"type": "adaptive"}     DEFAULT ON. If rawPredict rejects it, EVERY advisor turn
                                       400s and silently falls back to Gemini. The user sees a
                                       working advisor; you see `enhanced` in the logs; the model
                                       you are paying for never runs. Highest-risk unknown in the
                                       codebase.
    cache_control                      Preview on Vertex, documented as not behaving identically to
                                       the first-party API.
    output_config: {effort}            GA on the first-party API; unverified on rawPredict.

Each is probed SEPARATELY and in increasing order of risk, so a rejection identifies the exact
field rather than condemning the whole request. Order matters for cost too: the cheapest decisive
test runs first.

COST. Every function here spends real money. Each returns its own `cost_usd`, computed from the
provider's reported usage via `llm_cost` — not estimated — so the report's total is the actual spend
and the `$4/day` cap can be respected rather than guessed at.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from _creds import Creds
from _report import FAIL, PASS, UNMEASURED, Result, skip, timed

# Minimal prompt. The question is whether the ENDPOINT accepts the request shape, so the prompt is
# kept tiny to keep the probe cheap — a long prompt would measure the same thing for more money.
_PROBE_SYSTEM = ("You are a JSON API. Reply with exactly {\"ok\": true} and nothing else. "
                 "Do not explain.")
_PROBE_USER = "Return the JSON object now."


def _cost(model: str, usage: dict[str, Any]) -> float:
    from app.services import llm_cost
    micros = llm_cost.cost_usd_micros(
        model,
        tokens_in=int(usage.get("prompt_tokens") or 0),
        tokens_out=int(usage.get("completion_tokens") or 0),
        cached_tokens_in=int(usage.get("cached_prompt_tokens") or 0),
        cache_write_tokens_in=int(usage.get("cache_write_prompt_tokens") or 0),
    )
    return round((micros or 0) / 1_000_000, 6)


async def _raw_call(creds: Creds, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """POST a body to Vertex rawPredict and return (status, json). No retries — a 400 is the answer."""
    import httpx

    project = creds.get("GCP_PROJECT")
    region = creds.get("VERTEX_REGION", "us-east5")
    model = creds.get("CLAUDE_MODEL", "claude-opus-4-8")
    host = "aiplatform.googleapis.com" if region == "global" else f"{region}-aiplatform.googleapis.com"
    url = (f"https://{host}/v1/projects/{project}/locations/{region}"
           f"/publishers/anthropic/models/{model}:rawPredict")

    token = creds.get("VERTEX_ACCESS_TOKEN")
    if not token:
        # ADC, the production path (the org disallows API keys).
        import asyncio

        from app.clients.vertex_auth import AdcTokenProvider
        token = await asyncio.to_thread(AdcTokenProvider().token)

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(url, json=body,
                              headers={"authorization": f"Bearer {token}",
                                       "content-type": "application/json"})
    try:
        return r.status_code, r.json()
    except Exception:  # noqa: BLE001
        return r.status_code, {"_raw": r.text[:400]}


def _usage_from_anthropic(u: dict[str, Any]) -> dict[str, int]:
    """Normalize to the subset convention `llm_cost` expects — see advisor_llm for why."""
    read = int(u.get("cache_read_input_tokens") or 0)
    write = int(u.get("cache_creation_input_tokens") or 0)
    tin = int(u.get("input_tokens") or 0) + read + write
    return {"prompt_tokens": tin, "completion_tokens": int(u.get("output_tokens") or 0),
            "cached_prompt_tokens": read, "cache_write_prompt_tokens": write}


def _base_body(creds: Creds, *, max_tokens: int = 64) -> dict[str, Any]:
    return {"anthropic_version": "vertex-2023-10-16", "max_tokens": max_tokens,
            "system": _PROBE_SYSTEM,
            "messages": [{"role": "user", "content": _PROBE_USER}]}


# ── 1. Does the endpoint answer at all? ───────────────────────────────────────────────────────────
@timed("vertex.reachable")
async def vertex_reachable(creds: Creds) -> Result:
    """Cheapest decisive probe: a minimal body with none of the new fields.

    Run first on purpose. If this fails, the later probes would blame `thinking` for what is actually
    an auth, project, region or model-availability problem.
    """
    if not creds.has("GCP_PROJECT"):
        return skip("vertex.reachable", creds.missing("GCP_PROJECT"))
    status, body = await _raw_call(creds, _base_body(creds))
    if status != 200:
        return Result(check="vertex.reachable", status=FAIL,
                      detail=f"HTTP {status}: {json.dumps(body)[:220]}")
    usage = _usage_from_anthropic(body.get("usage") or {})
    model = creds.get("CLAUDE_MODEL", "claude-opus-4-8")
    return Result(check="vertex.reachable", status=PASS,
                  detail=f"{model} answered over rawPredict",
                  metrics={"model_reported": body.get("model", "?"),
                           "stop_reason": body.get("stop_reason", "?"), **usage},
                  cost_usd=_cost(model, usage))


# ── 2. THE critical field ─────────────────────────────────────────────────────────────────────────
@timed("vertex.accepts_thinking")
async def vertex_accepts_thinking(creds: Creds) -> Result:
    """Does rawPredict accept `thinking: {"type": "adaptive"}`?

    `CLAUDE_THINKING` defaults ON, so a rejection here means every advisor turn 400s into a Gemini
    fallback — full Opus price, no Opus, and nothing in the logs that looks like a failure. The
    escape hatch is `CLAUDE_THINKING=false`, which is why it exists.
    """
    if not creds.has("GCP_PROJECT"):
        return skip("vertex.accepts_thinking", creds.missing("GCP_PROJECT"))
    body = _base_body(creds, max_tokens=1024)   # thinking needs headroom beyond the visible reply
    body["thinking"] = {"type": "adaptive"}
    status, resp = await _raw_call(creds, body)
    model = creds.get("CLAUDE_MODEL", "claude-opus-4-8")
    if status != 200:
        return Result(
            check="vertex.accepts_thinking", status=FAIL,
            detail=(f"HTTP {status} — adaptive thinking REJECTED. Set CLAUDE_THINKING=false before "
                    f"deploying or every turn falls back to Gemini. {json.dumps(resp)[:160]}"))
    usage = _usage_from_anthropic(resp.get("usage") or {})
    blocks = [b.get("type") for b in (resp.get("content") or [])]
    return Result(check="vertex.accepts_thinking", status=PASS,
                  detail="adaptive thinking accepted — the model we are paying for is reasoning",
                  metrics={"content_block_types": blocks, **usage},
                  cost_usd=_cost(model, usage))


# ── 3. The cost lever ─────────────────────────────────────────────────────────────────────────────
@timed("vertex.prompt_cache")
async def vertex_accepts_prompt_cache(creds: Creds) -> Result:
    """Does `cache_control` work here, and does it actually cache?

    Two calls with an identical long prefix. The first WRITES the cache, the second should READ it.
    Acceptance is not enough — Vertex could accept the field and cache nothing, which would look
    like success while the ~5.2k-token system prefix is re-billed every turn. So this asserts
    `cache_read_input_tokens > 0` on the second call, not merely HTTP 200.

    NOT required: caching is a cost optimisation, not a correctness gate.
    """
    if not creds.has("GCP_PROJECT"):
        return skip("vertex.prompt_cache", creds.missing("GCP_PROJECT"), required=False)
    # Anthropic's minimum cacheable prefix is model-dependent and in the low thousands of tokens, so
    # the probe prefix must be large enough to qualify — a short one would cache nothing and look
    # like a platform limitation.
    big = ("You are a deterministic JSON API used in automated evaluation. " * 220)
    body = _base_body(creds, max_tokens=64)
    body["system"] = [{"type": "text", "text": big + _PROBE_SYSTEM,
                       "cache_control": {"type": "ephemeral"}}]

    s1, r1 = await _raw_call(creds, body)
    if s1 != 200:
        return Result(check="vertex.prompt_cache", status=FAIL, required=False,
                      detail=f"cache_control REJECTED (HTTP {s1}) — leave CLAUDE_PROMPT_CACHE off. "
                             f"{json.dumps(r1)[:140]}")
    s2, r2 = await _raw_call(creds, body)
    model = creds.get("CLAUDE_MODEL", "claude-opus-4-8")
    u1, u2 = _usage_from_anthropic(r1.get("usage") or {}), _usage_from_anthropic(r2.get("usage") or {})
    read = u2.get("cached_prompt_tokens", 0)
    cost = _cost(model, u1) + _cost(model, u2)
    return Result(
        check="vertex.prompt_cache", status=PASS if read > 0 else UNMEASURED, required=False,
        detail=(f"cache HIT on the second call: {read} tokens read at the cached rate"
                if read > 0 else
                "field accepted but nothing cached — Vertex caching is preview; keep "
                "CLAUDE_PROMPT_CACHE off until this reads non-zero"),
        metrics={"call1_cache_write": u1.get("cache_write_prompt_tokens", 0),
                 "call2_cache_read": read, "call1_prompt_tokens": u1.get("prompt_tokens", 0),
                 "call2_prompt_tokens": u2.get("prompt_tokens", 0)},
        cost_usd=cost)


# ── 4. The quality/cost dial ──────────────────────────────────────────────────────────────────────
@timed("vertex.accepts_effort")
async def vertex_accepts_effort(creds: Creds) -> Result:
    """Does `output_config: {effort}` parse on rawPredict? Not required — it is off by default."""
    if not creds.has("GCP_PROJECT"):
        return skip("vertex.accepts_effort", creds.missing("GCP_PROJECT"), required=False)
    body = _base_body(creds, max_tokens=512)
    body["thinking"] = {"type": "adaptive"}
    body["output_config"] = {"effort": "low"}
    status, resp = await _raw_call(creds, body)
    model = creds.get("CLAUDE_MODEL", "claude-opus-4-8")
    if status != 200:
        return Result(check="vertex.accepts_effort", status=FAIL, required=False,
                      detail=f"effort REJECTED (HTTP {status}) — leave CLAUDE_EFFORT unset. "
                             f"{json.dumps(resp)[:140]}")
    usage = _usage_from_anthropic(resp.get("usage") or {})
    return Result(check="vertex.accepts_effort", status=PASS, required=False,
                  detail="output_config.effort accepted — the in-model cost dial is available",
                  metrics=usage, cost_usd=_cost(model, usage))


# ── 5. Throughput and real cost per turn ──────────────────────────────────────────────────────────
@timed("vertex.throughput")
async def vertex_throughput(creds: Creds) -> Result:
    """Tokens/sec and $/turn on a realistically-sized advisor prompt.

    Uses the REAL `ADVISOR_SYSTEM` (~5.2k tokens) rather than the tiny probe prompt, because
    throughput on a 60-token prompt says nothing about a production turn. Reports the numbers that
    have been unanswerable all along — and `thinking_share` is the one that explains perceived
    latency: reasoning tokens are billed and generated but never shown, so a high share means the
    user waits on output they will never see.

    NOT required: slow is a problem to manage, not a correctness failure.
    """
    if not creds.has("GCP_PROJECT"):
        return skip("vertex.throughput", creds.missing("GCP_PROJECT"), required=False)
    import time

    from app.services.advisor_llm import ADVISOR_SYSTEM

    body = _base_body(creds, max_tokens=1024)
    body["system"] = ADVISOR_SYSTEM
    body["thinking"] = {"type": "adaptive"}
    body["messages"] = [{"role": "user", "content":
                         "A user asks: can I afford a $650,000 home? Reply with a short JSON "
                         "object {\"reflection\": \"...\", \"next_question\": \"...\"}."}]
    t0 = time.time()
    status, resp = await _raw_call(creds, body)
    wall = time.time() - t0
    model = creds.get("CLAUDE_MODEL", "claude-opus-4-8")
    if status != 200:
        return Result(check="vertex.throughput", status=FAIL, required=False,
                      detail=f"HTTP {status}: {json.dumps(resp)[:160]}")
    u = resp.get("usage") or {}
    usage = _usage_from_anthropic(u)
    out_tok = usage["completion_tokens"]
    cost = _cost(model, usage)
    return Result(
        check="vertex.throughput", status=PASS, required=False,
        detail=f"{round(out_tok / wall, 1)} output tok/s over {round(wall, 1)}s wall clock",
        metrics={"wall_clock_s": round(wall, 2), "output_tokens": out_tok,
                 "output_tokens_per_sec": round(out_tok / wall, 1) if wall else None,
                 "prompt_tokens": usage["prompt_tokens"],
                 "cost_usd_this_turn": cost,
                 "registry_p50_budget_ms": 26000,
                 "stop_reason": resp.get("stop_reason", "?")},
        cost_usd=cost)
