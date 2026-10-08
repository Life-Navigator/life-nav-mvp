"""Probe C — record/replay of model responses.

THE IDEA THAT MAKES THIS HARNESS AFFORDABLE
-------------------------------------------
Capture real model output ONCE, then replay it through the pipeline forever for free.

With Opus serving every route at roughly $0.15/turn against a $4/day cap, a live eval pass is a
budget event — a 20-case run is a meaningful fraction of a day's spend, and a 20-case run is far too
small to measure anything. Replay breaks that constraint: the expensive half (generation) is paid
once, and every later question about the pipeline is free.

It also buys the thing the live harness structurally cannot give you: ATTRIBUTION. Replaying
identical model output while changing the gate, the composer, the calculators or the validator means
the delta is caused by your change and nothing else. That is the discipline that produced the only
advisor number this project trusts — the control experiment that changed ONLY the model.

What replay cannot do: evaluate a change to the prompt, the context packet, or retrieval. Those
change the model's INPUT, so a recorded response no longer corresponds to the request. The cache key
is the prompt hash precisely so that case fails loudly as a cache miss instead of silently serving a
stale answer and reporting a fabricated delta.

HOW IT PLUGS IN
---------------
`RecordingLLM` wraps any object exposing the advisor's `generate(context, plan)` contract, so it
works with `GeminiAdvisorLLM`, `VertexClaudeAdvisorLLM`, or anything added later:

    record:  RecordingLLM(real_llm, mode="record")   # calls the model, writes fixtures. COSTS MONEY.
    replay:  RecordingLLM(None,     mode="replay")   # no model, no network, no spend.

Nothing here is imported by the application. It lives in `eval/` and is constructed only by the
harness, so production has no record hook, no extra branch, and no new dependency.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
from dataclasses import dataclass
from typing import Any, Literal, Optional

from .model import RECORDINGS

Mode = Literal["record", "replay"]


class RecordingMiss(RuntimeError):
    """No recording for this prompt.

    Deliberately an exception rather than a fallback to a live call. A silent fall-through would make
    a replay run quietly spend money, and — worse — a run that was supposed to hold the model fixed
    would start varying it, which destroys the attribution the whole approach exists to provide.
    """


def prompt_key(system: str, user: str, model: str) -> str:
    """Cache key over the EXACT request: model + system prompt + user prompt.

    Hashing the prompt rather than the case id is the load-bearing choice. Edit the system prompt or
    the context packet and every key changes, so the run fails as a miss instead of replaying answers
    to a question that is no longer being asked. An eval that reports a delta from stale recordings
    is worse than one that reports nothing.
    """
    h = hashlib.sha256()
    for part in (model, system, user):
        h.update(part.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:32]


@dataclass
class Recording:
    key: str
    model: str
    system_sha: str
    user_sha: str
    raw: str
    usage: dict[str, int]

    def as_dict(self) -> dict[str, Any]:
        return {"key": self.key, "model": self.model, "system_sha": self.system_sha,
                "user_sha": self.user_sha, "raw": self.raw, "usage": self.usage}


class RecordingStore:
    """One JSON file per recording, keyed by prompt hash.

    Separate files rather than one bundle so a single stale recording can be deleted and re-captured
    without invalidating the set, and so a diff shows exactly which responses changed.
    """

    def __init__(self, root: Optional[pathlib.Path] = None) -> None:
        self.root = root or RECORDINGS
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, key: str) -> pathlib.Path:
        return self.root / f"{key}.json"

    def has(self, key: str) -> bool:
        return self.path(key).exists()

    def get(self, key: str) -> Recording:
        p = self.path(key)
        if not p.exists():
            raise RecordingMiss(
                f"no recording for prompt {key}. The prompt or the context packet changed, or this "
                f"case was never recorded. Re-record with `--probe model --mode record` (this calls "
                f"the live model and spends budget); do NOT weaken the key to make it match."
            )
        d = json.loads(p.read_text())
        return Recording(key=d["key"], model=d["model"], system_sha=d["system_sha"],
                         user_sha=d["user_sha"], raw=d["raw"], usage=d.get("usage") or {})

    def put(self, rec: Recording) -> pathlib.Path:
        p = self.path(rec.key)
        p.write_text(json.dumps(rec.as_dict(), indent=2, sort_keys=True) + "\n")
        return p

    def count(self) -> int:
        return len(list(self.root.glob("*.json")))


class RecordingLLM:
    """Advisor-LLM shim that records live responses or replays stored ones.

    Mirrors the `generate(context, plan) -> dict | None` contract the orchestrator depends on, plus
    the `last_usage` / `last_raw` / `last_error` telemetry attributes it reads afterwards, so it can
    stand in for the real wrapper without the orchestrator knowing.
    """

    prompt_version = "eval-replay"

    def __init__(self, inner: Any = None, *, mode: Mode = "replay",
                 store: Optional[RecordingStore] = None, model: str = "replay") -> None:
        if mode == "record" and inner is None:
            raise ValueError("record mode needs a real LLM to record FROM")
        self._inner = inner
        self._mode: Mode = mode
        self._store = store or RecordingStore()
        self._model = getattr(inner, "model_name", None) or model
        self.last_usage: dict[str, int] = {}
        self.last_raw: str = ""
        self.last_error: str = ""
        self.misses: list[str] = []

    @property
    def available(self) -> bool:
        return True

    @property
    def provider(self) -> str:
        return getattr(self._inner, "provider", "eval_replay")

    @property
    def model_name(self) -> str:
        return self._model

    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]:
        from app.services.advisor_llm import _system_for, parse_advisor_json

        # Reconstructed to match GeminiAdvisorLLM byte-for-byte, so a key recorded through the real
        # wrapper is the same key replay computes. Any drift here silently turns every case into a
        # miss, which is at least loud.
        user = json.dumps({"guardrails": context.prompt_dict(), "constraints": plan},
                          ensure_ascii=False, default=str)
        prompt = (f"GUARDRAILS_AND_CONSTRAINTS:\n{user}\n\n"
                  f"Reason within these guardrails and return the JSON object now.")
        system = _system_for(context)
        key = prompt_key(system, prompt, self._model)

        if self._mode == "replay":
            try:
                rec = self._store.get(key)
            except RecordingMiss as exc:
                self.misses.append(key)
                self.last_error = "recording_miss"
                raise exc
            self.last_raw, self.last_usage = rec.raw, dict(rec.usage)
            return parse_advisor_json(rec.raw)

        out = await self._inner.generate(context, plan)
        self.last_raw = getattr(self._inner, "last_raw", "") or ""
        self.last_usage = dict(getattr(self._inner, "last_usage", {}) or {})
        self.last_error = getattr(self._inner, "last_error", "") or ""
        self._store.put(Recording(
            key=key, model=self._model,
            system_sha=hashlib.sha256(system.encode()).hexdigest()[:16],
            user_sha=hashlib.sha256(prompt.encode()).hexdigest()[:16],
            raw=self.last_raw, usage=self.last_usage,
        ))
        return out
