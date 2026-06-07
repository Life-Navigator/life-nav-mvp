"""Trust/Safety gate (F1 scaffold).

Every AI-generated payload (chat, recommendations, decision analysis) must pass
this gate before release. The full port of lib/governance + lib/constitutional
(governance + character + injection + domain medical/legal/financial boundaries)
lands with the chat/recommendation work in F2+. For F1 it provides the stable
interface so domain services can already route through it.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class TrustSafetyVerdict:
    passed: bool
    reasons: list[str] = field(default_factory=list)
    audit_id: Optional[str] = None
    character_score: Optional[float] = None


class TrustSafetyGate:
    """Buffer-then-release gate. F1 returns a permissive pass for non-AI,
    deterministic payloads (no model output yet). AI output review is wired in F2.
    """

    def review_output(self, text: str, *, domain: str = "core") -> TrustSafetyVerdict:
        # F1: deterministic domain view-models are not model output, so they pass.
        # F2 replaces this with governance + character + injection + boundary checks.
        return TrustSafetyVerdict(passed=True, reasons=["f1-scaffold: no model output to gate"])
