"""Trust/Safety Agent — the mandatory gate on every model output.

Thin agent wrapper over the ``TrustSafetyGate`` service so orchestration has a
uniform agent surface. Every Gemini-generated payload is reviewed here before
release; on block the orchestrator returns a safe fallback (never the raw text).
The full governance + character + injection + domain-boundary checks are ported
from lib/governance behind this interface.
"""
from __future__ import annotations

from ..services.trust_safety import TrustSafetyGate, TrustSafetyVerdict


class TrustSafetyAgent:
    def __init__(self, gate: TrustSafetyGate) -> None:
        self._gate = gate

    def review(self, text: str, *, domain: str = "core") -> TrustSafetyVerdict:
        return self._gate.review_output(text, domain=domain)
