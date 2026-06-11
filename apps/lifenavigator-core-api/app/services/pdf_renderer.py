"""Branded PDF renderer (Sprint 4) — the first production report (Education).

Turns an Education ReportDefinition into a branded, advisor-grade PDF via WeasyPrint
(HTML/CSS/SVG -> PDF). WeasyPrint is imported lazily so the app imports without it locally
(it lives in the deployed image). Charts are inline SVG from the cited series — no invented
data; every figure traces to the evidence appendix.
"""
from __future__ import annotations

import html as _html
from datetime import datetime, timezone
from typing import Any

from .charts import chart_svg

BRAND = "#4f46e5"
INK = "#111827"
MUTED = "#6b7280"


def _esc(v: Any) -> str:
    return _html.escape(str(v)) if v is not None else ""


def _css() -> str:
    return f"""
    @page {{ size: A4; margin: 2cm 1.8cm; @bottom-center {{ content: "LifeNavigator · Education Intelligence Report · page " counter(page); font-size: 8pt; color: {MUTED}; }} }}
    @page :first {{ margin: 0; }}
    body {{ font-family: 'DejaVu Sans', sans-serif; color: {INK}; font-size: 10.5pt; line-height: 1.5; }}
    .cover {{ height: 100vh; background: linear-gradient(135deg, {BRAND}, #312e81); color: white; padding: 4cm 2cm; }}
    .cover h1 {{ font-size: 30pt; margin: 3cm 0 0.3cm; }}
    .cover .sub {{ font-size: 13pt; opacity: 0.85; }}
    .cover .meta {{ position: absolute; bottom: 3cm; font-size: 10pt; opacity: 0.8; }}
    h2 {{ color: {BRAND}; font-size: 15pt; border-bottom: 2px solid {BRAND}; padding-bottom: 4px; margin-top: 24px; }}
    h3 {{ font-size: 11.5pt; margin: 12px 0 4px; }}
    .verdict {{ background: #eef2ff; border-left: 4px solid {BRAND}; padding: 10px 14px; border-radius: 4px; margin: 8px 0; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }}
    th, td {{ text-align: left; padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }}
    th {{ color: {MUTED}; font-weight: 600; }}
    .chart {{ margin: 10px 0; }}
    .muted {{ color: {MUTED}; font-size: 9pt; }}
    .cite {{ font-size: 8.5pt; color: {MUTED}; }}
    .boundary {{ background: #fffbeb; border: 1px solid #fde68a; padding: 8px 12px; border-radius: 4px; font-size: 9pt; color: #92400e; margin-top: 16px; }}
    .page-break {{ page-break-before: always; }}
    """


def _chart_block(charts: dict[str, dict], key: str) -> str:
    c = charts.get(key)
    return f'<div class="chart">{chart_svg(c)}</div>' if c else ""


def _kv_table(body: dict[str, Any], keys: list[tuple[str, str]]) -> str:
    rows = []
    for label, k in keys:
        if k in body and body[k] is not None:
            rows.append(f"<tr><th>{_esc(label)}</th><td>{_esc(body[k])}</td></tr>")
    return f"<table>{''.join(rows)}</table>" if rows else ""


def render_education_pdf(definition: dict[str, Any]) -> bytes:
    from weasyprint import HTML  # type: ignore[import-not-found]  # lazy — in the deployed image only

    return HTML(string=_education_html(definition)).write_pdf()


# ── Generic renderer: turns ANY ReportDefinition into a branded PDF (same framework) ──
_SUBTITLE = {
    "full": "Your complete life intelligence report",
    "financial": "Your financial position, trends, and recommendations",
    "decision": "Your analyzed life decisions",
    "family": "Your family protection, readiness, and planning",
    "compensation": "Your total compensation & benefits analysis",
    "education": "Programs ranked against your life goals",
    "health": "Your wellness, activity, and sleep guidance",
}
_MONEY_HINT = ("salary", "value", "cost", "balance", "amount", "comp", "savings", "benefit",
               "premium", "coverage", "contribution", "net_worth", "income", "bonus", "equity",
               "gap", "need", "pay", "match", "total", "tuition", "fund")


def render_report_pdf(definition: dict[str, Any], report_type: str = "full") -> bytes:
    """Branded PDF for any report type, rendered from its ReportDefinition. Education keeps its
    bespoke layout; every other type flows through this generic renderer (same framework)."""
    from weasyprint import HTML  # type: ignore[import-not-found]

    if report_type == "education":
        return HTML(string=_education_html(definition)).write_pdf()
    return HTML(string=_generic_html(definition, report_type)).write_pdf()


def _human(key: str) -> str:
    return str(key).replace("_", " ").strip().capitalize()


def _looks_money(key: str, val: Any) -> bool:
    return isinstance(val, (int, float)) and not isinstance(val, bool) and any(h in str(key).lower() for h in _MONEY_HINT) and abs(val) >= 100


def _fmt_scalar(key: str, val: Any) -> str:
    if val is None or val == "":
        return "—"
    if isinstance(val, bool):
        return "Yes" if val else "No"
    if _looks_money(key, val):
        return f"${val:,.0f}"
    if isinstance(val, float):
        return (f"{val:,.2f}".rstrip("0").rstrip("."))
    return _esc(val)


def _render_value(val: Any, key: str = "") -> str:
    """Recursively render a section-body value as readable HTML."""
    if isinstance(val, dict):
        rows = []
        for k, v in val.items():
            if isinstance(v, (dict, list)) and v:
                rows.append(f'<tr><td colspan="2"><div class="sub"><b>{_esc(_human(k))}</b>{_render_value(v, k)}</div></td></tr>')
            elif not isinstance(v, (dict, list)):
                rows.append(f"<tr><th>{_esc(_human(k))}</th><td>{_fmt_scalar(k, v)}</td></tr>")
        return f"<table>{''.join(rows)}</table>" if rows else ""
    if isinstance(val, list):
        if val and isinstance(val[0], dict):
            cols: list[str] = []
            for row in val:
                for c in row:
                    if c not in cols:
                        cols.append(c)
            head = "".join(f"<th>{_esc(_human(c))}</th>" for c in cols)
            body = "".join("<tr>" + "".join(f"<td>{_fmt_scalar(c, r.get(c))}</td>" for c in cols) + "</tr>" for r in val)
            return f"<table><tr>{head}</tr>{body}</table>"
        return "<ul>" + "".join(f"<li>{_esc(x)}</li>" for x in val) + "</ul>"
    return f"<p>{_fmt_scalar(key, val)}</p>"


def _generic_html(d: dict[str, Any], report_type: str) -> str:
    sections = sorted(d.get("sections", []), key=lambda s: s.get("ord", 0))
    charts = {c["key"]: c for c in d.get("charts", [])}
    now = datetime.now(timezone.utc).strftime("%B %d, %Y")
    title = _esc(d.get("title", "LifeNavigator Report"))
    subtitle = _SUBTITLE.get(report_type, "Your life intelligence report")

    cover = f"""
    <div class="cover">
      <div style="font-size:12pt;letter-spacing:3px;opacity:.7;">LIFENAVIGATOR</div>
      <h1>{title}</h1>
      <div class="sub">{_esc(subtitle)}</div>
      <div class="meta">Generated {now} · v{_esc(d.get('version', 1))} · evidence-grounded</div>
    </div>"""

    blocks = []
    for s in sections:
        body = _render_value(s.get("body", {}))
        cblocks = "".join(_chart_block(charts, ck) for ck in (s.get("charts") or []))
        ev = s.get("evidence") or []
        ev_html = ""
        if ev:
            ev_html = "<div class='ev'><b>Evidence</b><ul>" + "".join(
                f"<li>{_esc(e.get('metric_name'))}{(': ' + _esc(e.get('metric_value'))) if e.get('metric_value') not in (None, '') else ''} <span class='cite'>({_esc(e.get('source_table'))})</span></li>"
                for e in ev) + "</ul></div>"
        asm = s.get("assumptions") or []
        asm_html = ("<div class='muted'>Assumptions: " + " · ".join(_esc(a.get("text")) for a in asm) + "</div>") if asm else ""
        blocks.append(f'<div class="section"><h2>{_esc(s.get("title", ""))}</h2>{body}{cblocks}{ev_html}{asm_html}</div>')

    cites = " · ".join(_esc(c) for c in (d.get("citations") or []))
    cite_html = f'<div class="section"><h2>Sources</h2><p class="cite">{cites or "—"}</p></div>' if cites else ""
    boundary = (d.get("governance") or {}).get("disclaimer_text") or "Decision support — not financial, medical, legal, or tax advice."
    foot = f'<div class="boundary">{_esc(boundary)}</div>'
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{_css()}{_generic_css()}</style></head><body>{cover}{''.join(blocks)}{cite_html}{foot}</body></html>"


def _generic_css() -> str:
    return """
    .section { page-break-inside: avoid; margin-bottom: 6px; }
    .sub { margin: 4px 0 4px 10px; padding-left: 8px; border-left: 2px solid #eef2ff; }
    .ev { background: #f9fafb; border-radius: 4px; padding: 6px 10px; margin-top: 6px; font-size: 9pt; }
    .ev ul, table ul { margin: 2px 0; padding-left: 16px; }
    th { width: 45%; vertical-align: top; }
    h2 { page-break-after: avoid; }
    """


def _education_html(d: dict[str, Any]) -> str:
    sections = {s["key"]: s for s in d.get("sections", [])}
    charts = {c["key"]: c for c in d.get("charts", [])}
    exec_s = sections.get("1_executive_summary", {}).get("body", {})
    rec = sections.get("2_recommended_path", {}).get("body", {})
    alts = sections.get("3_alternative_paths", {}).get("body", {})
    roi = sections.get("4_roi_analysis", {}).get("body", {})
    fam = sections.get("7_family_impact", {}).get("body", {})
    risk = sections.get("8_risk_analysis", {}).get("body", {})
    appendix = sections.get("9_evidence_appendix", {})
    now = datetime.now(timezone.utc).strftime("%B %d, %Y")

    # Cover
    cover = f"""
    <div class="cover">
      <div style="font-size:12pt;letter-spacing:3px;opacity:.7;">LIFENAVIGATOR</div>
      <h1>{_esc(d.get('title', 'Education Report'))}</h1>
      <div class="sub">Education Intelligence Report — programs ranked against your life goals</div>
      <div class="meta">Generated {now} · v{_esc(d.get('version', 1))} · evidence-grounded</div>
    </div>"""

    # Executive summary
    es = f"""<div class="page-break"></div><h2>Executive Summary</h2>
      <div class="verdict">{_esc(exec_s.get('verdict', 'Programs compared against your goals.'))}</div>
      {_kv_table(exec_s, [('Best program', 'best_program'), ('Target role', 'target_role')])}"""

    # Program comparison
    rec_prog = rec.get('program') or {}
    alt_progs = alts.get('programs') or []
    comp_rows = "".join(
        f"<tr><td>{_esc(p.get('program_name'))}</td><td>{_money(p.get('net_cost'))}</td>"
        f"<td>{_money(p.get('income_lift'))}</td><td>{_esc(p.get('breakeven_months'))} mo</td>"
        f"<td>{_esc(round((p.get('composite') or 0)))}</td></tr>"
        for p in ([rec_prog] + alt_progs) if p.get('program_name'))
    pc = f"""<h2>Program Comparison</h2>
      <table><tr><th>Program</th><th>Net cost</th><th>Income lift</th><th>Breakeven</th><th>Score</th></tr>{comp_rows}</table>
      {_chart_block(charts, 'total_cost_comparison')}{_chart_block(charts, 'expected_salary_uplift')}"""

    # ROI
    roi_progs = roi.get('programs') or []
    roi_rows = "".join(
        f"<tr><td>{_esc(p.get('program'))}</td><td>{_money(p.get('net_cost'))}</td>"
        f"<td>{_money(p.get('opportunity_cost'))}</td><td>{_money(p.get('income_lift'))}</td>"
        f"<td>{_esc(p.get('breakeven_months'))} mo</td></tr>" for p in roi_progs)
    ra = f"""<div class="page-break"></div><h2>ROI Analysis</h2>
      <table><tr><th>Program</th><th>Net cost</th><th>Opportunity cost</th><th>Income lift</th><th>Breakeven</th></tr>{roi_rows}</table>
      {_chart_block(charts, 'roi_scenario_range')}{_chart_block(charts, 'score_radar')}{_chart_block(charts, 'breakeven_timeline')}"""

    # Family impact
    fam_block = ""
    if fam:
        fam_rows = "".join(f"<tr><td>{_esc(f.get('program'))}</td><td>{_esc(f.get('family_score'))}</td></tr>" for f in (fam.get('family_scores') or []))
        note = f'<p class="muted">{_esc(fam.get("note"))}</p>' if fam.get("note") else ""
        fam_block = f"""<h2>Family Impact</h2><table><tr><th>Program</th><th>Family fit</th></tr>{fam_rows}</table>{note}"""

    # Risk + confidence bands
    risk_rows = "".join(f"<tr><td>{_esc(p.get('program'))}</td><td>{_esc(p.get('risk_score'))}</td><td>{_money(p.get('worst_case_income_lift'))}</td></tr>" for p in (risk.get('programs') or []))
    rk = f"""<h2>Risk Analysis</h2><table><tr><th>Program</th><th>Risk score</th><th>Worst-case lift</th></tr>{risk_rows}</table>{_chart_block(charts, 'confidence_bands')}"""

    # Evidence + citations
    ev_rows = "".join(
        f"<tr><td>{_esc(e.get('metric_name'))}</td><td>{_esc(e.get('metric_value'))}</td>"
        f"<td class='cite'>{_esc(e.get('source_table'))}</td><td class='cite'>{_esc(e.get('confidence'))}</td></tr>"
        for e in (appendix.get('evidence') or []))
    cites = " · ".join(_esc(c) for c in (d.get('citations') or []))
    ev = f"""<div class="page-break"></div><h2>Evidence &amp; Sources</h2>
      <table><tr><th>Metric</th><th>Value</th><th>Source</th><th>Confidence</th></tr>{ev_rows}</table>
      <p class="cite"><b>Citations:</b> {cites or '—'}</p>"""

    boundary = (d.get('governance') or {}).get('disclaimer_text') or "Decision support, not admissions, financial, or legal advice."
    foot = f'<div class="boundary">{_esc(boundary)}</div>'

    return f"<!doctype html><html><head><meta charset='utf-8'><style>{_css()}</style></head><body>{cover}{es}{pc}{ra}{fam_block}{rk}{ev}{foot}</body></html>"


def _money(v: Any) -> str:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return "—"
    return f"${n:,.0f}"
