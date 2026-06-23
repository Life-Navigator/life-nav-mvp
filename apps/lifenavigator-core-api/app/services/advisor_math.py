"""Deterministic arithmetic verifier (Advisor V5 — grounded math).

The advisor may now state a COMPUTED number, but only through a structured `derivations` entry
({"label","expression","value"}). This module is the trust guarantee for that: a computed value is
accepted ONLY if
  1. every numeric operand in the expression traces to one of the USER's own numbers (any notation) or a
     tiny whitelist of unit constants (months/weeks/days per year, the percent base), AND
  2. the arithmetic is actually correct — we evaluate the expression ourselves (no eval(); a restricted
     AST walk over + - * / and parentheses) and compare to the claimed value within a rounding tolerance.

A derivation that introduces a non-user number (e.g. a made-up "20%" down-payment rate) or whose math is
wrong is REJECTED — its value is never added to the allowed set, so if the prose cites it the existing
number gate discards the whole turn. This keeps "zero fabrication" intact: no number reaches the user that
isn't either the user's own or a verified-correct computation from the user's own.
"""
from __future__ import annotations

import ast
import re
from typing import Any, Iterable

# Unit constants the model may use WITHOUT them being user numbers (time conversions + percent base).
_UNIT_CONSTANTS = {12.0, 52.0, 365.0, 100.0}
_EXPR_OK = re.compile(r"^[0-9.,\s()+\-*/%]+$")
_LITERAL = re.compile(r"\d[\d,]*(?:\.\d+)?")


def expand_money(token: str) -> set[float]:
    """All plausible numeric values for a user token like '$22k', '24%', '5,200'. Returns floats.
    For '$22k' → {22000}. For '24%' → {24, 0.24}. For '5,200' → {5200}. For '2.5M' → {2500000}."""
    t = str(token).strip().lower().lstrip("$").replace(",", "").replace(" ", "")
    pct = t.endswith("%")
    t = t.rstrip("%")
    mult = 1.0
    if t[-1:] == "k":
        mult, t = 1_000.0, t[:-1]
    elif t[-1:] == "m":
        mult, t = 1_000_000.0, t[:-1]
    elif t[-1:] == "b":
        mult, t = 1_000_000_000.0, t[:-1]
    if not t:
        return set()
    try:
        base = float(t)
    except ValueError:
        return set()
    out = {base, base * mult}
    if pct:
        out.add(base / 100.0)
    return out


def user_values(allowed_numbers: Iterable[str]) -> set[float]:
    """Float value set for the user's own numbers, expanded across notations (k/M/%/bare)."""
    vals: set[float] = set()
    for n in allowed_numbers or []:
        vals |= expand_money(n)
    return vals


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return float(node.value)
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
        a, b = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Add):
            return a + b
        if isinstance(node.op, ast.Sub):
            return a - b
        if isinstance(node.op, ast.Mult):
            return a * b
        return a / b if b != 0 else float("nan")
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        v = _eval(node.operand)
        return v if isinstance(node.op, ast.UAdd) else -v
    raise ValueError("disallowed expression node")


def _safe_eval(expr: str) -> float:
    """Evaluate a pure-arithmetic expression. '%' is treated as '/100'. Raises on anything non-arithmetic."""
    cleaned = expr.replace(",", "").replace("%", "/100")
    return _eval(ast.parse(cleaned, mode="eval").body)


def _forms(v: float) -> set[str]:
    """String forms a verified number may appear as in prose, matching the gate's normalization (no $/%/commas).
    Includes k/M-reduced forms so a verified 45000 also matches the model writing it as '$45k' (→ '45')."""
    out: set[str] = set()
    r = round(v)
    out.add(str(int(r)))
    if abs(v - r) > 1e-9:
        out.add(f"{v:.1f}".rstrip("0").rstrip("."))
        out.add(f"{v:.2f}".rstrip("0").rstrip("."))
    # k/M-reduced notation (only when it divides cleanly), so '$45k'/'$1.35M' forms of a verified value match
    for div in (1_000.0, 1_000_000.0):
        q = v / div
        if abs(q) >= 1 and abs(q - round(q, 2)) < 1e-9:
            out.add(str(int(round(q))) if abs(q - round(q)) < 1e-9 else f"{q:.2f}".rstrip("0").rstrip("."))
    return out


# A SCENARIO derivation (benchmark factor applied to a stated/scenario base) must be LABELED as an
# estimate/illustration or a recognized planning calc — so it reads as a scenario, never as the user's
# actual figure. (Strict derivations from the user's OWN numbers need no label — they ARE personal data.)
_SCENARIO_LABEL = re.compile(
    r"\b(estimat\w+|scenario|illustrat\w+|example|e\.g\.|hypothetical|assum\w+|projection|"
    r"down ?payment|closing|reserve|emergency fund|withdrawal|savings target|contribution|"
    r"months? of|years? of|percent of|% of)\b|~|≈",
    re.IGNORECASE,
)
# Benchmark factors are public planning constants (a percentage 0<p≤100, or a small month/year multiplier).
# They are allowed as derivation operands ONLY alongside ≥1 real user/scenario base AND a scenario label —
# never as a standalone fabricated figure.
_BENCHMARK_FACTOR_MAX = 100.0


def verify_derivations(
    derivations: Any, allowed_numbers: Iterable[str]
) -> tuple[set[str], set[str], list[dict[str, Any]]]:
    """Verify each derivation. Returns (strict_values, scenario_values, kept_derivations).

    * strict_values — derived ONLY from the user's own numbers + unit constants (12/52/365/100). These are
      the user's own math; they may be unioned into the gate's `allowed` set and bypass every check.
    * scenario_values — a benchmark factor (≤100: a percentage or a month/year multiplier) applied to a
      stated/scenario base, with a verifiable result AND a scenario/estimate label. These are allowed in
      prose EXCEPT inside a possessive personal claim ("your … is $X") — so "a 20% down payment is $100,000"
      passes while "your tax bill will be $18,200" stays blocked.
    A derivation with wrong math, no user base, or (for scenarios) no label is rejected entirely.
    """
    strict: set[str] = set()
    scenario: set[str] = set()
    kept: list[dict[str, Any]] = []
    if not isinstance(derivations, list):
        return strict, scenario, kept
    uvals = user_values(allowed_numbers)

    def _is_user(o: float) -> bool:
        return any(abs(o - u) < 0.5 or (u != 0 and abs(o - u) / abs(u) < 0.01) for u in uvals)

    def _is_unit(o: float) -> bool:
        return any(abs(o - u) < 1e-9 for u in _UNIT_CONSTANTS)

    for d in derivations:
        if not isinstance(d, dict):
            continue
        expr = str(d.get("expression") or "").strip()
        claimed = str(d.get("value") or "").strip()
        label = str(d.get("label") or "")
        if not expr or not claimed or not _EXPR_OK.match(expr):
            continue
        operands = [float(m.replace(",", "")) for m in _LITERAL.findall(expr)]
        if not operands:
            continue
        # Classify operands: user numbers, unit constants, or benchmark factors (0<o≤100).
        others = [o for o in operands if not _is_user(o) and not _is_unit(o)]
        is_strict = not others
        is_scenario = (
            not is_strict
            and any(_is_user(o) for o in operands)                       # a real base must be present
            and all(0.0 < o <= _BENCHMARK_FACTOR_MAX for o in others)    # only benchmark-scale factors
            and bool(_SCENARIO_LABEL.search(label) or _SCENARIO_LABEL.search(claimed))
        )
        if not (is_strict or is_scenario):
            continue
        try:
            computed = _safe_eval(expr)
        except Exception:  # noqa: BLE001
            continue
        if computed != computed or computed in (float("inf"), float("-inf")):  # NaN/inf guard
            continue
        claimed_vals = expand_money(claimed)
        if not claimed_vals:
            continue
        tol = max(1.0, abs(computed) * 0.05)  # allow the model's rounding
        if any(abs(computed - cv) <= tol for cv in claimed_vals):
            forms = set(_forms(computed))
            for cv in claimed_vals:
                forms |= _forms(cv)
            (strict if is_strict else scenario).update(forms)
            kept.append({"label": label, "expression": expr, "value": claimed,
                         "tier": "personal" if is_strict else "scenario"})
    return strict, scenario, kept
