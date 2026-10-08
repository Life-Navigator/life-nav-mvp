"""The readiness report — one table, honest statuses, and a verdict that cannot be fudged.

FOUR STATUSES, AND WHY THERE ARE FOUR
-------------------------------------
    PASS        checked against the live system and correct
    FAIL        checked and wrong
    UNMEASURED  not checked — missing credential, missing label set, or skipped
    BLOCKED     could not be checked because something upstream failed

UNMEASURED and BLOCKED exist so that "we did not look" can never be read as "it is fine". That
distinction is the whole reason this repo's beta gate table is trustworthy: every row there says
UNMEASURED rather than assuming, and the same discipline applies here. A runner that reported two
statuses would turn a one-day credential window into a green table that means nothing.

The verdict is a CONJUNCTION over required checks. There is no score, no percentage and no partial
credit, because "deploy readiness" is not an average — one failed tenant-isolation check is not
offset by nine healthy endpoints.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Optional

PASS, FAIL, UNMEASURED, BLOCKED = "PASS", "FAIL", "UNMEASURED", "BLOCKED"


@dataclass
class Result:
    check: str
    status: str
    detail: str = ""
    # Numbers worth keeping: latency, token counts, cost, dimensions, row counts.
    metrics: dict[str, Any] = field(default_factory=dict)
    # True when this check must pass before the candidate is deployable. A non-required check that
    # fails is information, not a stop.
    required: bool = True
    # Seconds. A one-day credential window makes the cost of each check worth seeing.
    elapsed_s: float = 0.0
    # Spend attributable to this check, in USD. Model calls only.
    cost_usd: float = 0.0

    def as_dict(self) -> dict[str, Any]:
        return {"check": self.check, "status": self.status, "detail": self.detail,
                "metrics": self.metrics, "required": self.required,
                "elapsed_s": round(self.elapsed_s, 2), "cost_usd": round(self.cost_usd, 4)}


class Report:
    def __init__(self) -> None:
        self.results: list[Result] = []
        self.started = time.time()

    def add(self, r: Result) -> Result:
        self.results.append(r)
        # Printed as it lands, not at the end. A credential window can close, a key can be revoked,
        # or a run can be interrupted — findings already made must survive that.
        icon = {PASS: "✓", FAIL: "✗", UNMEASURED: "·", BLOCKED: "–"}.get(r.status, "?")
        req = "" if r.required else "  (not required)"
        print(f"  {icon} {r.status:10} {r.check:46} {r.detail[:72]}{req}")
        for k, v in r.metrics.items():
            print(f"                 {k:28} {v}")
        return r

    @property
    def cost_usd(self) -> float:
        return sum(r.cost_usd for r in self.results)

    def verdict(self) -> tuple[bool, list[str]]:
        """(ready, reasons). Ready requires every REQUIRED check to be PASS.

        UNMEASURED counts against readiness for a required check — deliberately. "We could not
        verify the fatal tenant-isolation gate" is not a pass, and the one thing this report must
        never do is let an unchecked requirement look satisfied.
        """
        reasons: list[str] = []
        for r in self.results:
            if not r.required:
                continue
            if r.status == FAIL:
                reasons.append(f"FAILED: {r.check} — {r.detail}")
            elif r.status in (UNMEASURED, BLOCKED):
                reasons.append(f"{r.status}: {r.check} — {r.detail or 'not verified'}")
        return (not reasons), reasons

    def render(self) -> str:
        ready, reasons = self.verdict()
        counts = {s: sum(1 for r in self.results if r.status == s)
                  for s in (PASS, FAIL, UNMEASURED, BLOCKED)}
        lines = ["", "=" * 86, "LIVE READINESS REPORT", "=" * 86, ""]
        for r in self.results:
            icon = {PASS: "✓", FAIL: "✗", UNMEASURED: "·", BLOCKED: "–"}.get(r.status, "?")
            flag = "" if r.required else " (not required)"
            lines.append(f"  {icon} {r.status:10} {r.check}{flag}")
            if r.detail:
                lines.append(f"      {r.detail}")
            for k, v in r.metrics.items():
                lines.append(f"      · {k}: {v}")
        lines += ["", "-" * 86,
                  f"  {counts[PASS]} pass · {counts[FAIL]} fail · "
                  f"{counts[UNMEASURED]} unmeasured · {counts[BLOCKED]} blocked",
                  f"  elapsed {int(time.time() - self.started)}s · model spend "
                  f"${self.cost_usd:.4f}", ""]
        if ready:
            lines += ["  VERDICT: every REQUIRED check passed.", "",
                      "  This is a technical verdict only. No test can clear the operational gates,",
                      "  and these remain open regardless of the table above:",
                      "    - error tracking in production (captureException currently no-ops)",
                      "    - branch protection on main (currently force-pushable)",
                      "    - HA and redundancy (single machine, 512MB, one region, per app)",
                      "    - load behaviour under concurrency (never tested)",
                      "    - the R-6 owner sign-off on the 11 safety scenarios"]
        else:
            lines += ["  VERDICT: NOT READY.", ""]
            lines += [f"    - {r}" for r in reasons]
        lines += ["=" * 86]
        return "\n".join(lines)

    def write_json(self, path: str) -> None:
        with open(path, "w") as fh:
            json.dump({"results": [r.as_dict() for r in self.results],
                       "cost_usd": round(self.cost_usd, 4),
                       "ready": self.verdict()[0],
                       "reasons": self.verdict()[1]}, fh, indent=2)


def timed(name: str):
    """Decorator: time a check and convert an unexpected exception into a FAIL, never a crash.

    A check that raises must not end the run — with a one-day credential window, losing the
    remaining checks to one unhandled exception is the most expensive possible failure mode.

    `name` is explicit so the exception path reports the SAME check name as the success path. It
    previously fell back to the function's name, so a crashed check appeared under a different label
    than the one it uses when it works, which is confusing precisely when something is broken.
    """
    import functools

    def deco(fn):
        @functools.wraps(fn)
        async def wrapper(*a, **k) -> Result:
            t0 = time.time()
            try:
                r = await fn(*a, **k)
            except Exception as exc:  # noqa: BLE001
                r = Result(check=name, status=FAIL,
                           detail=f"{type(exc).__name__}: {exc}"[:200])
            r.elapsed_s = time.time() - t0
            r.check = r.check or name
            return r

        wrapper.check_name = name  # type: ignore[attr-defined]
        return wrapper

    return deco


def skip(check: str, missing: list[str], *, required: bool = True) -> Result:
    return Result(check=check, status=UNMEASURED, required=required,
                  detail=f"missing credentials: {', '.join(missing)}")
