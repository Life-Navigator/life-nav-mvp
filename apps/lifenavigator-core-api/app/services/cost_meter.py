"""Cost meter (F1 scaffold).

Records per-request model/token cost for observability + budget enforcement.
F1 keeps an in-process counter and structured log; F2 persists to
``ops.llm_usage_meter`` and wires the economic budgets/circuit-breakers.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

log = logging.getLogger("core.cost")


@dataclass
class Usage:
    user_id: str
    domain: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


class CostMeter:
    def __init__(self) -> None:
        self._output_tokens = 0

    def record(self, usage: Usage) -> None:
        self._output_tokens += usage.output_tokens
        log.info(
            '{"event":"usage","user":"%s","domain":"%s","model":"%s","in":%d,"out":%d}',
            usage.user_id,
            usage.domain,
            usage.model,
            usage.input_tokens,
            usage.output_tokens,
        )

    @property
    def output_tokens(self) -> int:
        return self._output_tokens
