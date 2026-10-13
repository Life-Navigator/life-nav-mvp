"""Calculation persistence and the answer cache (Milestone 3.6).

WHY NOTHING WORKED WITHOUT THIS
-------------------------------
No computed figure was stored anywhere, so every advisor turn recomputed everything and nothing
could be compared to anything. Three capabilities all waited on the same missing table:

**Plan vs actual.** "In June we said you could retire at 62" is only answerable if June's figures
still exist. Recomputing today's answer and presenting it as June's is the specific dishonesty this
prevents — and it is the one a user would never catch.

**Audit.** A figure the advisor stated six months ago has to stay explainable, with the inputs it
rested on and the law-year it was computed under.

**The answer cache.** The same question asked twice should re-run the CALCULATORS — deterministic,
sub-millisecond, free — and spend model tokens only if the numbers actually moved. That is the
whole economic argument: the expensive part of an answer is the prose, and the prose only needs
rewriting when the figures change.

THE FINGERPRINT HAS TWO HALVES, AND THE SECOND ONE IS THE SUBTLE ONE
--------------------------------------------------------------------
`inputs_fingerprint` covers the user's own facts. `basis_fingerprint` covers the LAW: which tax
table year was actually used, which parameter year, and whether either was verified. Both must
match for a cached answer to be served.

Without the second half the cache is actively wrong rather than merely stale. Every tax figure in
this engine currently falls back to the newest VERIFIED year, which is 2024. The moment the owner's
CPA verifies the 2026 tables, every figure changes — and an answer cached under the old basis would
keep being served, quietly answering a 2026 question with 2024 law. Nothing in the user's own data
changed, so an inputs-only fingerprint would see no reason to refresh.

WHY THE QUESTION MATCH IS EXACT AND NOT FUZZY
---------------------------------------------
A fuzzy match that occasionally serves the answer to a *different* question trades the product's
trustworthiness for a token saving. That is never the right trade, so normalization is conservative
— case, punctuation, whitespace and a small set of filler words — and nothing else. The hit rate is
lower than a semantic cache would give and every hit is correct, which is the only version worth
shipping.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Any, Optional

log = logging.getLogger(__name__)

_SCHEMA = "finance"
_SNAPSHOTS = "calculation_snapshots"
_ANSWERS = "answer_cache"

# Dropped before hashing a question. Deliberately tiny: every word removed is a chance for two
# different questions to collide, and a collision here serves the wrong answer.
_FILLER = frozenset({"a", "an", "the", "please", "could", "would", "can", "you", "tell", "me",
                     "just", "so", "hey", "hi", "and"})

# Keys in a resolver field that describe the VALUE rather than its provenance. Confidence and
# source labels change without the figure changing, and hashing them would miss cache hits for no
# gain.
_VALUE_KEY = "value"


def _canonical(obj: Any) -> Any:
    """A form that hashes identically regardless of dict ordering or float noise."""
    if isinstance(obj, dict):
        return {k: _canonical(obj[k]) for k in sorted(obj)}
    if isinstance(obj, (list, tuple)):
        return [_canonical(x) for x in obj]
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, float):
        # Rounded so $1234.5600001 and $1234.56 are one fact. Six places keeps rates distinct.
        return round(obj, 6)
    return obj


def _digest(payload: Any) -> str:
    return hashlib.sha256(
        json.dumps(_canonical(payload), sort_keys=True, default=str).encode()
    ).hexdigest()[:32]


def inputs_fingerprint(inputs: dict[str, Any]) -> str:
    """Fingerprint of the user's own facts — PRESENT values only.

    Absent inputs are excluded rather than hashed as null, so adding an unrelated missing field to
    the resolver does not invalidate every user's cache. What matters is whether the facts the
    figures were computed FROM have changed.
    """
    facts = {
        name: (field or {}).get(_VALUE_KEY)
        for name, field in sorted((inputs or {}).items())
        if (field or {}).get("present")
    }
    return _digest(facts)


def basis_fingerprint(packet: dict[str, Any]) -> str:
    """Fingerprint of the LAW the figures rested on.

    Read out of the results' own provenance rather than from the requested tax year, because the
    requested year is NOT what was used: every tax calculator falls back to the newest verified
    table, so a 2026 request is currently computed on 2024 law. Hashing the request would make the
    cache blind to the verification that changes every number.
    """
    basis: list[Any] = []
    for r in (packet or {}).get("results") or []:
        detail = r.get("detail") or {}
        used = r.get("inputs_used") or {}
        basis.append([
            r.get("calculator"),
            used.get("tax_year"),
            detail.get("table_provenance"),
            detail.get("parameters_provenance"),
            detail.get("parameter_year"),
            detail.get("rate_year"),
        ])
    for t in (packet or {}).get("treatments") or []:
        basis.append([t.get("rule"), t.get("parameter_year"), t.get("parameters_verified")])
    basis.append((packet or {}).get("tax_year_requested"))
    return _digest(basis)


def question_signature(message: str) -> Optional[str]:
    """An exact, conservatively normalized question key — or None when it is not cacheable.

    Returns None for anything too short to be a distinct question. A two-word message ("what now?")
    would collide across wildly different contexts, and a cache miss costs tokens while a collision
    costs trust.
    """
    if not message:
        return None
    text = re.sub(r"[^a-z0-9\s%$.]", " ", message.strip().lower())
    words = [w for w in text.split() if w and w not in _FILLER]
    if len(words) < 4:
        return None
    return _digest(words)


def cited_numbers(answer: str) -> list[str]:
    """Figures the answer asserted, so a recompute can tell whether it went stale.

    The belt to the fingerprint's braces: if any cited figure would now compute differently the
    answer is stale even if the fingerprints somehow agree.
    """
    return sorted({m.group(0).replace(",", "")
                   for m in re.finditer(r"\d[\d,]*(?:\.\d+)?", answer or "")})


@dataclass(frozen=True)
class CachedAnswer:
    answer: str
    created_at: Optional[str]
    hit_count: int
    question_text: str

    def as_dict(self) -> dict[str, Any]:
        return {"answer": self.answer, "created_at": self.created_at,
                "hit_count": self.hit_count, "question_text": self.question_text,
                "served_from": "answer_cache"}


class CalculationStore:
    """Persists calculation packets and serves the answer cache.

    Every method is best-effort and swallows storage failures: persistence is an enhancement, and a
    cache that can break a turn is worse than no cache. A failed READ returns a miss, which costs
    tokens; a failed WRITE is logged and dropped.
    """

    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    # ── Snapshots ────────────────────────────────────────────────────────────────────────────────
    async def save_snapshot(self, user_id: str, packet: dict[str, Any], *,
                            tax_year: Optional[int] = None,
                            inputs: Optional[dict[str, Any]] = None) -> Optional[str]:
        """Store what was computed. Returns the fingerprint pair's inputs half, or None."""
        if not packet or not packet.get("available"):
            return None
        try:
            fp_in = inputs_fingerprint(inputs or {})
            fp_basis = basis_fingerprint(packet)
            present = sorted(n for n, f in (inputs or {}).items() if (f or {}).get("present"))
            await self._sb.insert(_SNAPSHOTS, {
                "user_id": user_id,
                "packet": packet,
                "inputs_fingerprint": fp_in,
                "basis_fingerprint": fp_basis,
                "tax_year": tax_year,
                "calculator_count": len(packet.get("results") or []),
                "treatment_count": len(packet.get("treatments") or []),
                "gap_count": len(packet.get("gaps") or [])
                + len(packet.get("treatment_gaps") or []),
                "inputs_present": present,
            }, schema=_SCHEMA)
            return fp_in
        except Exception as exc:  # noqa: BLE001 — never break a turn to store telemetry
            log.warning("calculation snapshot not stored: %s", exc)
            return None

    async def previous_snapshot(self, user_id: str) -> Optional[dict[str, Any]]:
        """The most recent stored packet, for plan-vs-actual. None when there is no history."""
        try:
            rows = await self._sb.select(
                _SNAPSHOTS, filters={"user_id": f"eq.{user_id}"},
                order="created_at.desc", limit=1, schema=_SCHEMA)
            return rows[0] if rows else None
        except Exception as exc:  # noqa: BLE001
            log.warning("calculation snapshot unavailable: %s", exc)
            return None

    async def what_changed(self, user_id: str, packet: dict[str, Any],
                           inputs: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """How today's figures differ from the last stored ones.

        THE POINT: a plan that moved should say WHY it moved. Comparing the figures alone gives
        "your retirement number went up", which is not useful; comparing the inputs that were
        present as well gives "because you added your cost basis", which is.
        """
        prev = await self.previous_snapshot(user_id)
        if not prev:
            return {"has_history": False}
        old_packet = prev.get("packet") or {}
        old = {r.get("calculator"): r.get("value")
               for r in (old_packet.get("results") or [])}
        new = {r.get("calculator"): r.get("value")
               for r in (packet.get("results") or [])}
        moved = [
            {"calculator": k, "was": old[k], "now": new[k],
             "change": round(float(new[k]) - float(old[k]), 2)}
            for k in sorted(set(old) & set(new))
            if isinstance(old[k], (int, float)) and isinstance(new[k], (int, float))
            and abs(float(new[k]) - float(old[k])) > 0.005
        ]
        old_inputs = set(prev.get("inputs_present") or [])
        return {
            "has_history": True,
            "as_of": prev.get("created_at"),
            "moved": moved,
            "newly_computable": sorted(set(new) - set(old)),
            "no_longer_computable": sorted(set(old) - set(new)),
            "basis_changed": prev.get("basis_fingerprint") != basis_fingerprint(packet),
            # WHY the figures moved, which is the useful half. "Your retirement number went up"
            # is not advice; "it went up because you added your cost basis" is.
            "inputs_added": sorted(
                {n for n, f in (inputs or {}).items() if (f or {}).get("present")}
                - old_inputs) or None,
        }

    # ── The answer cache ─────────────────────────────────────────────────────────────────────────
    async def lookup_answer(self, user_id: str, message: str,
                            packet: dict[str, Any],
                            inputs: dict[str, Any]) -> Optional[CachedAnswer]:
        """A prior answer to THIS question, valid for the current facts and the current law.

        Returns None on any doubt. The calculators have already re-run by the time this is called —
        that is the design: recompute the cheap deterministic half every turn, and reuse the
        expensive prose only when the recomputed figures are identical.
        """
        sig = question_signature(message)
        if not sig:
            return None
        try:
            rows = await self._sb.select(
                _ANSWERS,
                filters={"user_id": f"eq.{user_id}", "question_signature": f"eq.{sig}"},
                limit=5, schema=_SCHEMA)
        except Exception as exc:  # noqa: BLE001 — a failed read is a miss, which only costs tokens
            log.warning("answer cache unavailable: %s", exc)
            return None

        fp_in = inputs_fingerprint(inputs)
        fp_basis = basis_fingerprint(packet)
        for row in rows:
            if row.get("inputs_fingerprint") != fp_in:
                continue
            if row.get("basis_fingerprint") != fp_basis:
                # The LAW moved even though the user's facts did not. This is the case an
                # inputs-only cache gets wrong, and it is not rare: it happens the moment the 2026
                # tables are verified and every tax figure in the engine changes.
                continue
            # Every figure the answer asserted must still be one the gate would allow. An answer
            # citing a number the engine no longer computes is stale whatever the fingerprints say.
            allowed = set(packet.get("allowed_numbers") or []) | set(
                packet.get("scenario_numbers") or [])
            cited = [c for c in (row.get("cited_numbers") or [])]
            if cited and allowed and not set(cited).issubset(allowed):
                continue
            # Read the count BEFORE touching. `_touch` updates the same row, and a client that
            # returns the live dict rather than a copy would then be counted twice — which is
            # exactly what happened: the first hit reported 2.
            hits = int(row.get("hit_count") or 0)
            await self._touch(row.get("id"), hits)
            return CachedAnswer(
                answer=row.get("answer") or "",
                created_at=row.get("created_at"),
                hit_count=hits + 1,
                question_text=row.get("question_text") or "",
            )
        return None

    async def save_answer(self, user_id: str, message: str, answer: str,
                          packet: dict[str, Any], inputs: dict[str, Any], *,
                          model: Optional[str] = None) -> bool:
        """Cache an answer against the facts and the law it was computed on."""
        sig = question_signature(message)
        if not sig or not answer or not answer.strip():
            return False
        if not packet or not packet.get("available"):
            # An answer computed with no grounding has no fingerprint worth keying on, and caching
            # it would serve ungrounded prose after the grounding arrived.
            return False
        try:
            await self._sb.insert(_ANSWERS, {
                "user_id": user_id,
                "question_signature": sig,
                "question_text": message[:2000],
                "answer": answer,
                "inputs_fingerprint": inputs_fingerprint(inputs),
                "basis_fingerprint": basis_fingerprint(packet),
                "cited_numbers": cited_numbers(answer),
                "model": model,
            }, schema=_SCHEMA)
            return True
        except Exception as exc:  # noqa: BLE001
            log.warning("answer not cached: %s", exc)
            return False

    async def _touch(self, row_id: Any, hits: int) -> None:
        if not row_id:
            return
        try:
            # An ISO timestamp, NOT the string "now()": PostgREST sends this as JSON, so a SQL
            # function name would be stored verbatim as a four-character string.
            await self._sb.update(
                _ANSWERS,
                {"hit_count": hits + 1,
                 "last_served_at": datetime.now(timezone.utc).isoformat()},
                filters={"id": f"eq.{row_id}"}, schema=_SCHEMA)
        except Exception:  # noqa: BLE001 — a missed hit count is not worth a log line per turn
            pass
