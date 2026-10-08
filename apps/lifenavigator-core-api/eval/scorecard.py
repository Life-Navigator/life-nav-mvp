"""Scorecard — per-probe metrics, baseline deltas, and the CI verdict.

THE ONE RULE THIS FILE EXISTS TO ENFORCE
----------------------------------------
Trust failures and quality failures are reported SEPARATELY and never combined into a single score.

    under_block_rate  — a fabricated personal figure reached the user.  TRUST failure.
    over_block_rate   — a legitimate answer was blocked or redacted.    QUALITY failure.

They are not interchangeable and they are not symmetric. One fabricated net-worth figure delivered
as fact is worse than ten over-cautious redactions, and a mean of the two would let a gate trade a
trust violation for a quality win and still look like it improved. So there is no overall score
here on purpose: the verdict is a conjunction of per-metric gates.

BASELINE COMPARISON
-------------------
CI gates on REGRESSION against a committed baseline, not on absolute perfection. The gate currently
over-blocks in a known way (an unrelated possessive clause trailing a hedged estimate), and
demanding perfection would mean either a permanently red build or quietly relabelling that case as
correct. A baseline makes the current state explicit and makes any worsening of it loud.

A baseline is only comparable when it was produced from the same fixture version. Scoring against a
baseline from a different case set is how an eval starts reporting progress that is really just an
easier question, so that mismatch is refused rather than warned about.
"""
from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass, field
from typing import Any, Optional

from .model import BASELINES, UNMEASURED, CaseResult


@dataclass
class ProbeScore:
    """One probe's result. `UNMEASURED` is a first-class outcome, not a zero."""

    probe: str
    fixture_version: str
    status: str = UNMEASURED
    must_pass_total: int = 0
    must_pass_blocked: int = 0          # over-blocks → quality cost
    must_block_total: int = 0
    must_block_passed: int = 0          # under-blocks → trust cost
    known_divergences: int = 0
    refused: int = 0                    # present but unscoreable — never part of a rate
    results: list[CaseResult] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def over_block_rate(self) -> Optional[float]:
        if not self.must_pass_total:
            return None
        return round(100.0 * self.must_pass_blocked / self.must_pass_total, 2)

    @property
    def under_block_rate(self) -> Optional[float]:
        if not self.must_block_total:
            return None
        return round(100.0 * self.must_block_passed / self.must_block_total, 2)

    @property
    def measured(self) -> bool:
        return bool(self.must_pass_total or self.must_block_total)

    def as_dict(self) -> dict[str, Any]:
        return {
            "probe": self.probe,
            "fixture_version": self.fixture_version,
            "status": self.status if self.measured else UNMEASURED,
            "must_pass_total": self.must_pass_total,
            "must_pass_blocked": self.must_pass_blocked,
            "over_block_rate_pct": self.over_block_rate,
            "must_block_total": self.must_block_total,
            "must_block_passed": self.must_block_passed,
            "under_block_rate_pct": self.under_block_rate,
            "known_divergences": self.known_divergences,
            "refused_unscoreable": self.refused,
            "failures": [
                {"case_id": r.case_id, "expected": r.expected, "actual": r.actual,
                 "known_divergence": r.known_divergence, **r.detail}
                for r in self.results if not r.ok
            ],
            "notes": self.notes,
        }


def score(probe: str, fixture_version: str, results: list[CaseResult],
          notes: Optional[list[str]] = None) -> ProbeScore:
    s = ProbeScore(probe=probe, fixture_version=fixture_version, results=results,
                   notes=list(notes or []))
    for r in results:
        if r.known_divergence:
            s.known_divergences += 1
        if r.refused:
            # Excluded from both rates. "We could not check this" and "this failed" are different
            # statements and must never be summed into one percentage.
            s.refused += 1
            continue
        if r.direction == "must_pass":
            s.must_pass_total += 1
            if not r.ok:
                s.must_pass_blocked += 1
        elif r.direction == "must_block":
            s.must_block_total += 1
            if not r.ok:
                s.must_block_passed += 1
    s.status = "MEASURED" if s.measured else UNMEASURED
    return s


# ── Baselines ─────────────────────────────────────────────────────────────────────────────────────
def baseline_path(probe: str) -> pathlib.Path:
    return BASELINES / f"{probe}.json"


def save_baseline(s: ProbeScore) -> pathlib.Path:
    """Freeze the current state as the thing future runs are compared against.

    Writing a baseline is a DELIBERATE act (`--save-baseline`), never automatic. An eval that
    re-baselines itself on every run can only ever report "no change", which is the most comfortable
    and least useful thing an eval can say.
    """
    p = baseline_path(s.probe)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(s.as_dict(), indent=2, sort_keys=True) + "\n")
    return p


def load_baseline(probe: str) -> Optional[dict[str, Any]]:
    p = baseline_path(probe)
    return json.loads(p.read_text()) if p.exists() else None


@dataclass
class Verdict:
    ok: bool
    lines: list[str] = field(default_factory=list)


def compare(s: ProbeScore) -> Verdict:
    """Compare a score to its baseline. Any WORSENING of either rate fails.

    An improvement never fails, but it does print a reminder to re-baseline — otherwise the next run
    silently gets credit for a gain that was already banked, and the baseline drifts into being a
    historical curiosity rather than a gate.
    """
    v = Verdict(ok=True)
    base = load_baseline(s.probe)

    if not s.measured:
        v.lines.append(f"{s.probe}: {UNMEASURED} — no fixtures; nothing was checked")
        return v  # not a failure, but never reported as a pass either

    if base is None:
        v.lines.append(f"{s.probe}: no baseline — run with --save-baseline to freeze this state")
        v.lines.append(f"  over-block {s.over_block_rate}%  under-block {s.under_block_rate}%")
        return v

    if base.get("fixture_version") != s.fixture_version:
        v.ok = False
        v.lines.append(
            f"{s.probe}: REFUSING to compare — baseline fixture v{base.get('fixture_version')} "
            f"vs current v{s.fixture_version}. Scoring across case sets reports an easier question "
            f"as progress. Re-baseline deliberately."
        )
        return v

    for label, now, before, kind in (
        ("under-block (TRUST)", s.under_block_rate, base.get("under_block_rate_pct"), "trust"),
        ("over-block (QUALITY)", s.over_block_rate, base.get("over_block_rate_pct"), "quality"),
    ):
        if now is None or before is None:
            continue
        if now > before:
            v.ok = False
            v.lines.append(f"{s.probe}: {label} REGRESSED {before}% → {now}%")
        elif now < before:
            v.lines.append(f"{s.probe}: {label} improved {before}% → {now}% (re-baseline to bank it)")
        else:
            v.lines.append(f"{s.probe}: {label} unchanged at {now}%")

    return v


def render(scores: list[ProbeScore], verdicts: list[Verdict]) -> str:
    """Human-readable report. The two rates are always on separate lines, never summarised."""
    out: list[str] = ["", "=" * 78, "ADVISOR EVALUATION HARNESS", "=" * 78]
    for s in scores:
        out.append("")
        out.append(f"── {s.probe}  (fixtures v{s.fixture_version})  [{s.status}]")
        if not s.measured:
            if s.refused:
                out.append(f"   nothing scored — {s.refused} case(s) present but unscoreable "
                           f"(see notes); NOT a pass and NOT a failure")
            else:
                out.append("   nothing measured — no fixtures for this probe")
            for n in s.notes:
                out.append(f"   note: {n}")
            continue
        out.append(f"   TRUST    under-block {s.under_block_rate}%   "
                   f"({s.must_block_passed}/{s.must_block_total} fabrications reached the user)")
        out.append(f"   QUALITY  over-block  {s.over_block_rate}%   "
                   f"({s.must_pass_blocked}/{s.must_pass_total} legitimate answers blocked)")
        if s.known_divergences:
            out.append(f"   {s.known_divergences} annotated known divergence(s) — counted, not failing CI")
        if s.refused:
            out.append(f"   {s.refused} case(s) unscoreable — excluded from both rates")
        for f in s.as_dict()["failures"]:
            mark = "known" if f["known_divergence"] else "FAIL "
            out.append(f"     [{mark}] {f['case_id']}: expected {f['expected']}, got {f['actual']}")
            if f["known_divergence"]:
                out.append(f"             reason: {f['known_divergence']}")
        for n in s.notes:
            out.append(f"   note: {n}")

    out.append("")
    out.append("── baseline comparison")
    for v in verdicts:
        for line in v.lines:
            out.append(f"   {line}")
    overall = all(v.ok for v in verdicts)
    out.append("")
    out.append(f"VERDICT: {'OK' if overall else 'REGRESSION'}")
    out.append("=" * 78)
    return "\n".join(out)
