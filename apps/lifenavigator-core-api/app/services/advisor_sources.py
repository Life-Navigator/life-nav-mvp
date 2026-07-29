"""Server-owned catalog of verifiable reference sources the advisor may link to.

WHY A CATALOG AND NOT FREE-TEXT URLS
------------------------------------
A market price ("a home inspection runs about $400–600") is unverifiable by us — there is no source of
truth in the system for what an inspection costs. The honest response is not to suppress the number, it's
to hand the user somewhere to check it. But a model asked to produce a URL will produce a plausible one,
and a dead or invented link is a worse trust break than the number it was meant to support: it looks like
a citation.

So the model never writes a URL. It picks a KEY from the list below (the keys are injected into the prompt)
and the server resolves it to a label + URL it owns. An unknown key is dropped, not guessed at. This is the
same principle the number gate applies to digits, applied to links: the model proposes, the server owns
what is rendered.

Every URL here is an authoritative root or a stable long-lived landing page — root-ish by design, because a
deep path is what rots. Adding an entry means committing to keep it alive; prefer .gov and standards bodies
over commercial sites, whose URLs and paywalls move.
"""
from __future__ import annotations

from typing import Any

# key -> (label shown to the user, url, what it's good for — the last field is prompt-facing only)
MARKET_SOURCES: dict[str, tuple[str, str, str]] = {
    "consumer_finance": (
        "CFPB — Consumer Financial Protection Bureau", "https://www.consumerfinance.gov/",
        "mortgages, closing costs, loan fees, credit, debt collection",
    ),
    "mortgage_rates": (
        "Freddie Mac — Primary Mortgage Market Survey", "https://www.freddiemac.com/pmms",
        "current average mortgage rates",
    ),
    "irs": (
        "IRS", "https://www.irs.gov/",
        "tax brackets, deductions, contribution limits, filing rules",
    ),
    "ssa": (
        "Social Security Administration", "https://www.ssa.gov/",
        "Social Security benefit estimates and claiming ages",
    ),
    "bls_wages": (
        "BLS — Occupational Outlook Handbook", "https://www.bls.gov/ooh/",
        "salary ranges, job outlook, and typical education by occupation",
    ),
    "college_scorecard": (
        "College Scorecard", "https://collegescorecard.ed.gov/",
        "real tuition, debt, and post-graduation earnings by school and program",
    ),
    "student_aid": (
        "Federal Student Aid", "https://studentaid.gov/",
        "FAFSA, federal loan limits, repayment and forgiveness programs",
    ),
    "investor_gov": (
        "Investor.gov (SEC)", "https://www.investor.gov/",
        "investing basics, fee comparisons, adviser background checks",
    ),
    "medicare": (
        "Medicare", "https://www.medicare.gov/",
        "Medicare enrollment, coverage, and premiums",
    ),
    "healthcare_gov": (
        "HealthCare.gov", "https://www.healthcare.gov/",
        "marketplace health plans, subsidies, and enrollment periods",
    ),
    "insurance_naic": (
        "NAIC — insurance consumer information", "https://content.naic.org/consumer",
        "insurance shopping, complaint records, and licensing by state",
    ),
    "eldercare": (
        "Eldercare Locator", "https://eldercare.acl.gov/",
        "long-term care, caregiving, and aging services by locality",
    ),
    "fdic": (
        "FDIC", "https://www.fdic.gov/",
        "deposit insurance limits and bank safety",
    ),
}


def prompt_block() -> str:
    """The catalog rendered for the system prompt — keys plus what each one is for."""
    lines = [f"    {key} — {purpose}" for key, (_lbl, _url, purpose) in MARKET_SOURCES.items()]
    return "\n".join(lines)


def resolve(raw: Any) -> list[dict[str, str]]:
    """Turn the model's proposed `sources` into rendered, server-owned links.

    Keeps only known keys, in the model's order, de-duplicated. Anything else — an unknown key, a raw URL
    the model tried to smuggle in, a malformed entry — is silently dropped; the answer is still fine
    without it, and a wrong link is worse than no link."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in (raw or []) if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip().lower()
        if key not in MARKET_SOURCES or key in seen:
            continue
        seen.add(key)
        label, url, _purpose = MARKET_SOURCES[key]
        entry = {"key": key, "label": label, "url": url}
        # `for` is the model's one free-text field here: which figure this link backs. It is rendered, so it
        # is length-capped, but it carries no numbers of its own that the gate hasn't already seen.
        why = str(item.get("for") or "").strip()
        if why:
            entry["for"] = why[:120]
        out.append(entry)
    return out
