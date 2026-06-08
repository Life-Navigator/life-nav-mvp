"""Universal SVG chart generators (Sprint 4).

Pure-Python SVG (WeasyPrint renders inline SVG natively) from a ChartDefinition. Supported:
bar, radar, range (confidence band / scenario), line (trend), timeline, goal_progress. No
external chart deps; every chart is built from the cited series — no invented data.
"""
from __future__ import annotations

import math
from typing import Any

BRAND = "#4f46e5"   # indigo
BRAND2 = "#10b981"  # emerald
WARN = "#e11d48"    # rose
GRID = "#e5e7eb"
TEXT = "#374151"


def _num(v: Any) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def chart_svg(chart: dict[str, Any]) -> str:
    t = str(chart.get("type", "bar"))
    if t == "radar":
        return _radar(chart)
    if t in ("range", "scenario"):
        return _range(chart)
    if t == "line":
        return _line(chart)
    if t == "timeline":
        return _timeline(chart)
    if t == "goal_progress":
        return _goal_progress(chart)
    return _bar(chart)


def _frame(w: int, h: int, inner: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" font-family="DejaVu Sans, sans-serif">{inner}</svg>')


def _bar(chart: dict[str, Any]) -> str:
    series = [s for s in (chart.get("series") or []) if _num(s.get("value")) is not None]
    if not series:
        return _empty(chart)
    w, h, pad = 520, 220, 90
    vals = [_num(s["value"]) or 0 for s in series]
    vmax = max(max(vals), 1.0)
    vmin = min(min(vals), 0.0)
    span = (vmax - vmin) or 1.0
    bw = (w - pad - 20) / max(len(series), 1)
    bars = []
    for i, s in enumerate(series):
        v = _num(s["value"]) or 0
        x = pad + i * bw + 8
        bh = (abs(v) / span) * (h - 60)
        y = (h - 30) - ((v - vmin) / span) * (h - 60)
        color = WARN if v < 0 else BRAND
        bars.append(f'<rect x="{x:.0f}" y="{min(y, h-30):.0f}" width="{bw-16:.0f}" height="{bh:.0f}" rx="3" fill="{color}"/>')
        bars.append(f'<text x="{x + (bw-16)/2:.0f}" y="{h-12}" font-size="9" fill="{TEXT}" text-anchor="middle">{_short(s.get("label"))}</text>')
        bars.append(f'<text x="{x + (bw-16)/2:.0f}" y="{min(y, h-30)-4:.0f}" font-size="9" fill="{TEXT}" text-anchor="middle">{_fmt(v)}</text>')
    title = f'<text x="12" y="20" font-size="13" font-weight="bold" fill="{TEXT}">{chart.get("title","")}</text>'
    axis = f'<line x1="{pad}" y1="{h-30}" x2="{w-10}" y2="{h-30}" stroke="{GRID}"/>'
    return _frame(w, h, title + axis + "".join(bars))


def _radar(chart: dict[str, Any]) -> str:
    spec = chart.get("spec") or chart
    axes = spec.get("axes") or []
    values = spec.get("values") or {}
    if not axes:
        return _empty(chart)
    w, h, cx, cy, r = 360, 320, 180, 175, 110
    n = len(axes)
    pts = []
    grid = []
    for ring in (0.33, 0.66, 1.0):
        ring_pts = []
        for i in range(n):
            a = -math.pi / 2 + 2 * math.pi * i / n
            ring_pts.append(f"{cx + r*ring*math.cos(a):.0f},{cy + r*ring*math.sin(a):.0f}")
        grid.append(f'<polygon points="{" ".join(ring_pts)}" fill="none" stroke="{GRID}"/>')
    labels = []
    for i, ax in enumerate(axes):
        a = -math.pi / 2 + 2 * math.pi * i / n
        val = (_num(values.get(ax)) or 0) / 100.0
        pts.append(f"{cx + r*val*math.cos(a):.0f},{cy + r*val*math.sin(a):.0f}")
        lx, ly = cx + (r + 18) * math.cos(a), cy + (r + 14) * math.sin(a)
        labels.append(f'<text x="{lx:.0f}" y="{ly:.0f}" font-size="9" fill="{TEXT}" text-anchor="middle">{ax}</text>')
    poly = f'<polygon points="{" ".join(pts)}" fill="{BRAND}33" stroke="{BRAND}" stroke-width="2"/>'
    title = f'<text x="12" y="18" font-size="13" font-weight="bold" fill="{TEXT}">{chart.get("title","")}</text>'
    return _frame(w, h, title + "".join(grid) + poly + "".join(labels))


def _range(chart: dict[str, Any]) -> str:
    spec = chart.get("spec") or chart
    worst, exp, best = _num(spec.get("worst")), _num(spec.get("expected")), _num(spec.get("best"))
    if exp is None and worst is None and best is None:
        return _empty(chart)
    vals = [v for v in (worst, exp, best) if v is not None]
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    w, h, pad = 520, 120, 40
    sx = lambda v: pad + ((v - lo) / span) * (w - pad - 40)  # noqa: E731
    bar = f'<line x1="{sx(lo):.0f}" y1="60" x2="{sx(hi):.0f}" y2="60" stroke="{BRAND}" stroke-width="6" stroke-linecap="round"/>'
    marks = []
    for label, v, col in (("worst", worst, WARN), ("expected", exp, BRAND), ("best", best, BRAND2)):
        if v is None:
            continue
        marks.append(f'<circle cx="{sx(v):.0f}" cy="60" r="7" fill="{col}"/>')
        marks.append(f'<text x="{sx(v):.0f}" y="44" font-size="9" fill="{TEXT}" text-anchor="middle">{label}</text>')
        marks.append(f'<text x="{sx(v):.0f}" y="84" font-size="9" fill="{TEXT}" text-anchor="middle">{_fmt(v)}</text>')
    title = f'<text x="12" y="20" font-size="13" font-weight="bold" fill="{TEXT}">{chart.get("title","")}</text>'
    return _frame(w, h, title + bar + "".join(marks))


def _line(chart: dict[str, Any]) -> str:
    series = [s for s in (chart.get("series") or []) if _num(s.get("value")) is not None]
    if len(series) < 2:
        return _bar(chart)
    w, h, pad = 520, 200, 50
    vals = [_num(s["value"]) or 0 for s in series]
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    step = (w - pad - 20) / (len(series) - 1)
    pts = [f"{pad + i*step:.0f},{(h-30) - ((v-lo)/span)*(h-60):.0f}" for i, v in enumerate(vals)]
    line = f'<polyline points="{" ".join(pts)}" fill="none" stroke="{BRAND}" stroke-width="2"/>'
    title = f'<text x="12" y="20" font-size="13" font-weight="bold" fill="{TEXT}">{chart.get("title","")}</text>'
    return _frame(w, h, title + line)


def _timeline(chart: dict[str, Any]) -> str:
    series = chart.get("series") or []
    w, h, pad = 520, 110, 30
    step = (w - pad - 20) / max(len(series), 1)
    axis = f'<line x1="{pad}" y1="60" x2="{w-10}" y2="60" stroke="{GRID}" stroke-width="2"/>'
    marks = []
    for i, s in enumerate(series):
        x = pad + i * step + step / 2
        marks.append(f'<circle cx="{x:.0f}" cy="60" r="6" fill="{BRAND}"/>')
        marks.append(f'<text x="{x:.0f}" y="44" font-size="9" fill="{TEXT}" text-anchor="middle">{_short(s.get("label"))}</text>')
        if s.get("value") is not None:
            marks.append(f'<text x="{x:.0f}" y="82" font-size="9" fill="{TEXT}" text-anchor="middle">{_fmt(_num(s.get("value")))}</text>')
    title = f'<text x="12" y="20" font-size="13" font-weight="bold" fill="{TEXT}">{chart.get("title","")}</text>'
    return _frame(w, h, title + axis + "".join(marks))


def _goal_progress(chart: dict[str, Any]) -> str:
    spec = chart.get("spec") or chart
    pct = max(0.0, min(1.0, (_num(spec.get("value")) or 0) / 100.0))
    w, h = 520, 70
    track = f'<rect x="12" y="30" width="{w-24}" height="16" rx="8" fill="{GRID}"/>'
    fill = f'<rect x="12" y="30" width="{(w-24)*pct:.0f}" height="16" rx="8" fill="{BRAND2}"/>'
    title = f'<text x="12" y="20" font-size="12" fill="{TEXT}">{chart.get("title","")} — {pct*100:.0f}%</text>'
    return _frame(w, h, title + track + fill)


def _empty(chart: dict[str, Any]) -> str:
    return _frame(520, 60, f'<text x="12" y="34" font-size="11" fill="#9ca3af">{chart.get("title","")}: data not available</text>')


def _fmt(v: float | None) -> str:
    if v is None:
        return "—"
    a = abs(v)
    if a >= 1000:
        return f"${v/1000:.0f}k"
    if a <= 1 and v != 0:
        return f"{v:.2f}"
    return f"{v:.0f}"


def _short(s: Any, n: int = 16) -> str:
    s = str(s or "")
    return (s[: n - 1] + "…") if len(s) > n else s
