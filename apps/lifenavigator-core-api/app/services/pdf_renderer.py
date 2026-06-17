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
    # P4 — advisor-grade briefing for the full/financial life report.
    if report_type in ("full", "financial"):
        adv = next((s.get("body") for s in definition.get("sections", []) if s.get("key") == "advisor_executive"), None)
        if adv:
            return HTML(string=_full_html(adv, definition, report_type)).write_pdf()
    return HTML(string=_generic_html(definition, report_type)).write_pdf()


# ── Advisor-grade "Life Briefing" renderer (P4) ──────────────────────────────
_STATUS = {"green": ("#047857", "#ecfdf5", "On track"), "yellow": ("#b45309", "#fffbeb", "Caution"),
           "orange": ("#b45309", "#fff7ed", "Attention"), "red": ("#be123c", "#fff1f2", "Attention needed")}


def _risk_text(x: Any) -> str:
    if isinstance(x, dict):
        return str(x.get("label") or x.get("title") or x.get("risk") or x)
    return str(x)


def _full_css() -> str:
    return f"""
    @page {{ size: A4; margin: 1.6cm 1.6cm 1.8cm; @bottom-center {{ content: "LifeNavigator · Life Briefing · " counter(page); font-size: 8pt; color: {MUTED}; }} }}
    @page :first {{ margin: 0; }}
    body {{ font-family: 'DejaVu Sans', sans-serif; color: {INK}; font-size: 10pt; line-height: 1.5; }}
    .cover {{ height: 100vh; background: linear-gradient(150deg, {BRAND} 0%, #312e81 60%, #1e1b4b 100%); color: #fff; padding: 3.4cm 2.2cm; position: relative; }}
    .cover .brand {{ font-size: 11pt; letter-spacing: 4px; opacity: .65; }}
    .cover h1 {{ font-size: 32pt; margin: 2.4cm 0 .2cm; font-weight: 700; }}
    .cover .tag {{ font-size: 12.5pt; opacity: .82; }}
    .cover .score {{ margin-top: 1.6cm; display: flex; gap: 1.2cm; align-items: flex-end; }}
    .cover .score .big {{ font-size: 56pt; font-weight: 800; line-height: 1; }}
    .cover .score .lbl {{ font-size: 9pt; letter-spacing: 2px; opacity: .7; text-transform: uppercase; }}
    .cover .obj {{ margin-top: 1cm; font-size: 13pt; opacity: .92; max-width: 13cm; }}
    .cover .meta {{ position: absolute; bottom: 2.4cm; font-size: 9.5pt; opacity: .75; }}
    .sec {{ page-break-inside: avoid; margin: 0 0 14px; }}
    h2 {{ color: {BRAND}; font-size: 14pt; margin: 22px 0 8px; padding-bottom: 3px; border-bottom: 2px solid #e0e7ff; page-break-after: avoid; }}
    h2 .n {{ color: #c7d2fe; font-weight: 700; margin-right: 8px; }}
    .lead {{ background: #eef2ff; border-left: 4px solid {BRAND}; padding: 10px 14px; border-radius: 6px; }}
    .grid {{ display: flex; flex-wrap: wrap; gap: 10px; }}
    .pill {{ display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 8.5pt; font-weight: 600; }}
    .chip {{ flex: 1 1 30%; min-width: 4cm; border: 1px solid #eef2ff; border-radius: 8px; padding: 9px 11px; }}
    .chip .d {{ font-size: 9pt; color: {MUTED}; text-transform: capitalize; }}
    .chip .v {{ font-size: 16pt; font-weight: 700; }}
    .bar {{ height: 6px; border-radius: 4px; background: #eef2ff; margin-top: 5px; overflow: hidden; }}
    .bar > i {{ display: block; height: 100%; border-radius: 4px; }}
    .rec {{ border: 1px solid #e5e7eb; border-radius: 8px; padding: 11px 13px; margin: 8px 0; page-break-inside: avoid; }}
    .rec .t {{ font-weight: 700; font-size: 11pt; }}
    .rec .why {{ color: #374151; margin: 3px 0; }}
    .rec .meta {{ font-size: 8.5pt; color: {MUTED}; }}
    .rec .ev {{ background: #f9fafb; border-radius: 6px; padding: 7px 10px; margin-top: 6px; font-size: 8.5pt; }}
    .src {{ font-family: 'DejaVu Sans Mono', monospace; font-size: 7.5pt; color: {MUTED}; background:#fff; border:1px solid #e5e7eb; border-radius:3px; padding:0 4px; }}
    .col2 {{ display: flex; gap: 16px; }} .col2 > div {{ flex: 1; }}
    ul.tight {{ margin: 4px 0; padding-left: 16px; }} ul.tight li {{ margin: 2px 0; }}
    .empty {{ color: #9ca3af; font-style: italic; font-size: 9pt; }}
    table.appx {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
    table.appx td {{ padding: 4px 8px; border-bottom: 1px solid #eef2ff; }} table.appx td:first-child {{ color: {MUTED}; }}
    .boundary {{ background: #fffbeb; border: 1px solid #fde68a; padding: 8px 12px; border-radius: 6px; font-size: 8.5pt; color: #92400e; margin-top: 18px; }}
    .pb {{ page-break-before: always; }}
    """


def _bar(pct: Any, status: str) -> str:
    p = max(0, min(100, int(pct or 0)))
    col = _STATUS.get(status, ("#6366f1", "", ""))[0]
    return f'<div class="bar"><i style="width:{p}%;background:{col}"></i></div>'


def _full_html(adv: dict[str, Any], d: dict[str, Any], report_type: str) -> str:
    now = datetime.now(timezone.utc).strftime("%B %d, %Y")
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    cov = adv.get("cover") or {}
    readiness = adv.get("readiness") or {}
    recs = adv.get("recommendations") or []
    goals = adv.get("goals") or []
    risks = adv.get("risks") or []
    opps = adv.get("opportunities") or []
    nba = adv.get("next_best_action")
    plan = adv.get("plan_90") or {}
    appx = adv.get("appendix") or {}
    score = cov.get("readiness")

    # 1 — Cover
    cover = f"""<div class="cover">
      <div class="brand">LIFENAVIGATOR</div>
      <h1>Life Briefing</h1>
      <div class="tag">An advisor-grade summary of your situation, goals, risks &amp; recommended actions</div>
      <div class="score">
        <div><div class="big">{_esc(score) if score is not None else '—'}</div><div class="lbl">Life Readiness</div></div>
        {f'<div><div class="big" style="font-size:30pt">{_esc(cov.get("confidence_pct"))}%</div><div class="lbl">Objective confidence</div></div>' if cov.get("confidence_pct") is not None else ''}
      </div>
      <div class="obj">{('“' + _esc(adv.get('vision')) + '”') if adv.get('vision') else (_esc(cov.get('objective')) if cov.get('objective') else 'Your life model is still forming — talk to your advisor to complete it.')}</div>
      <div class="meta">Generated {now} · {ts} · v{_esc(d.get('version', 1))} · 100% evidence-grounded</div>
    </div>"""

    # 2 — Executive summary
    def _li(items, fmt=_esc, empty="None recorded yet."):
        items = [x for x in (items or []) if x]
        if not items:
            return f'<p class="empty">{empty}</p>'
        return '<ul class="tight">' + "".join(f"<li>{fmt(x)}</li>" for x in items[:5]) + "</ul>"

    nba_html = (f'<div class="lead"><b>Next best action:</b> {_esc(nba.get("title"))}'
                f'{(" — " + _esc(nba.get("why"))) if nba.get("why") else ""}'
                f'{(" · " + str(round((nba.get("confidence") or 0)*100)) + "% confidence") if nba.get("confidence") is not None else ""}</div>'
                ) if nba else '<p class="empty">No recommended action yet — add data so we can compute one.</p>'
    exec_s = f"""<div class="pb"></div><h2><span class="n">1</span>Executive Summary</h2>
      {nba_html}
      <div class="col2" style="margin-top:10px">
        <div><h3 style="font-size:10pt;color:{MUTED}">Top priorities</h3>{_li([r.get('title') for r in recs[:4]], empty='No prioritized actions yet.')}</div>
        <div><h3 style="font-size:10pt;color:{MUTED}">Top risks</h3>{_li(risks, _risk_text, 'No risks identified yet.')}</div>
      </div>
      <div class="col2">
        <div><h3 style="font-size:10pt;color:{MUTED}">Top opportunities</h3>{_li(opps, _risk_text, 'No opportunities identified yet.')}</div>
        <div><h3 style="font-size:10pt;color:{MUTED}">Goals tracked</h3>{_li([g.get('title') for g in goals], empty='No goals set yet.')}</div>
      </div>"""

    # 3 — Readiness overview
    if readiness.get("domains"):
        chips = "".join(
            f'<div class="chip"><div class="d">{_esc(dn.get("domain"))}</div>'
            f'<div class="v" style="color:{_STATUS.get(dn.get("status"), ("#111827","",""))[0]}">{_esc(dn.get("progress"))}%</div>'
            f'<span class="pill" style="background:{_STATUS.get(dn.get("status"),("#eef2ff","#eef2ff",""))[1]};color:{_STATUS.get(dn.get("status"),("#6366f1","",""))[0]}">{_STATUS.get(dn.get("status"),("","","—"))[2]}</span>'
            f'{_bar(dn.get("progress"), dn.get("status"))}</div>'
            for dn in readiness["domains"])
        readi = f'<h2><span class="n">2</span>Life Readiness</h2><div class="grid">{chips}</div>'
    else:
        readi = '<h2><span class="n">2</span>Life Readiness</h2><p class="empty">Readiness fills in as you connect data across your domains.</p>'

    # 4 — Goal progress
    if goals:
        grows = ""
        for g in goals[:8]:
            pct = g.get("progress")
            if pct is None and g.get("target_value") and g.get("current_value") is not None:
                pct = round((g["current_value"] / g["target_value"]) * 100)
            grows += (f'<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:9.5pt">'
                      f'<b>{_esc(g.get("title") or "Goal")}</b><span style="color:{MUTED}">{(str(int(pct))+"%") if pct is not None else _esc(g.get("status") or "")}</span></div>'
                      f'{_bar(pct, "green")}</div>')
        goalsec = f'<h2><span class="n">3</span>Goal Progress</h2>{grows}'
    else:
        goalsec = '<h2><span class="n">3</span>Goal Progress</h2><p class="empty">No goals yet — set goals to track real progress here.</p>'

    # 5/6/7/8 — Recommendations with explainability + evidence + assumptions + missing data
    if recs:
        rblocks = ""
        for r in recs:
            ev = r.get("evidence") or []
            asm = r.get("assumptions") or []
            dom = " ".join(f'<span class="pill" style="background:#eef2ff;color:{BRAND}">{_esc(x)}</span>' for x in (r.get("domains") or []))
            ev_html = ("<div class='ev'><b>Data used &amp; sources</b>" + "".join(
                f'<div>• {_esc(e.get("statement") or "datapoint")} <span class="src">{_esc(e.get("source"))}</span></div>' for e in ev) + "</div>") if ev else '<div class="empty" style="margin-top:5px">No evidence attached yet.</div>'
            asm_html = ("<div style='margin-top:5px;font-size:8.5pt'><b>Assumptions:</b> " + " · ".join(f"{_esc(a.get('label'))}: {_esc(a.get('value'))}" for a in asm) + "</div>") if asm else "<div class='empty' style='margin-top:5px'>No assumptions recorded.</div>"
            rblocks += (f'<div class="rec"><div class="t">{_esc(r.get("title"))}</div>'
                        f'<div class="why">{_esc(r.get("why") or "")}</div>'
                        f'<div class="meta">priority {_esc(r.get("priority") or "—")} · '
                        f'{(str(round((r.get("confidence") or 0)*100)) + "% confidence") if r.get("confidence") is not None else "confidence n/a"}'
                        f'{(" · " + _esc(r.get("expected_impact"))) if r.get("expected_impact") else ""}</div>'
                        f'<div style="margin-top:5px">{dom}</div>{ev_html}{asm_html}</div>')
        recsec = f'<div class="pb"></div><h2><span class="n">4</span>Recommendations &amp; Evidence</h2>{rblocks}'
    else:
        recsec = '<div class="pb"></div><h2><span class="n">4</span>Recommendations &amp; Evidence</h2><p class="empty">No recommendations yet — add documents or connect accounts and they appear here, each with its evidence.</p>'

    # 9 — Missing data
    missing = adv.get("missing_data") or []
    missec = (f'<h2><span class="n">5</span>Missing Data</h2><p>Adding the following would unlock stronger, more precise recommendations:</p><ul class="tight">'
              + "".join(f"<li>{_esc(m)}</li>" for m in missing[:8]) + "</ul>") if missing else '<h2><span class="n">5</span>Missing Data</h2><p class="empty">No missing-data analysis recorded.</p>'

    # 11 — 90-day action plan
    def _plan_block(label, items):
        items = [x for x in (items or []) if x]
        return f'<h3 style="font-size:10pt">{label}</h3>' + (('<ul class="tight">' + "".join(f"<li>{_esc(x)}</li>" for x in items[:4]) + "</ul>") if items else '<p class="empty">—</p>')
    blocked = plan.get("blocked") or []
    blk = ('<h3 style="font-size:10pt">Blocked / needs data</h3><ul class="tight">' + "".join(f'<li>{_esc(b.get("title"))} <span style="color:#b45309">— {_esc(b.get("why"))}</span></li>' for b in blocked[:4]) + "</ul>") if blocked else ""
    plansec = (f'<div class="pb"></div><h2><span class="n">6</span>Your 90-Day Action Plan</h2>'
               f'{_plan_block("Now", plan.get("now"))}{_plan_block("Next", plan.get("next"))}{_plan_block("Later", plan.get("later"))}{blk}') if plan else ''

    # 12 — Appendix
    appxsec = (f'<h2><span class="n">7</span>Appendix</h2><table class="appx">'
               f'<tr><td>Report version</td><td>v{_esc(d.get("version", 1))}</td></tr>'
               f'<tr><td>Generated</td><td>{ts}</td></tr>'
               f'<tr><td>Recommendations</td><td>{_esc(appx.get("recommendation_count", 0))}</td></tr>'
               f'<tr><td>Evidence items</td><td>{_esc(appx.get("evidence_count", 0))}</td></tr>'
               f'<tr><td>Goals tracked</td><td>{_esc(appx.get("goal_count", 0))}</td></tr>'
               f'<tr><td>Average confidence</td><td>{(str(appx.get("avg_confidence_pct")) + "%") if appx.get("avg_confidence_pct") is not None else "—"}</td></tr>'
               f'</table>')

    boundary = (d.get("governance") or {}).get("disclaimer_text") or "Decision support — not financial, medical, legal, or tax advice. Every figure traces to your real data."
    foot = f'<div class="boundary">{_esc(boundary)}</div>'
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{_full_css()}</style></head><body>"
            f"{cover}{exec_s}{readi}{goalsec}{recsec}{missec}{plansec}{appxsec}{foot}</body></html>")


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
