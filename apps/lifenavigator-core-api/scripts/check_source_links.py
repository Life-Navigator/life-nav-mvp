#!/usr/bin/env python3
"""Link-check the advisor's source catalog. Run before release, and on a schedule.

    python scripts/check_source_links.py [--timeout 20]

The catalog is the one thing in the advisor that points OFF our platform, so it is the one thing that can
rot without any code changing. A dead link under "Check current numbers" is worse than no link: it reads as
a citation, so it lends authority to the number it was supposed to let the user verify.

Exit codes: 0 all reachable · 1 at least one hard failure (404/DNS/timeout).

NOTE ON 403s — read before "fixing" one. Most sites in this catalog sit behind a WAF (Akamai and friends)
that blocks datacenter egress and unfamiliar HTTP clients. Observed 2026-07-28: ssa.gov and bls.gov refuse
every client from this network, and consumerfinance.gov refuses urllib while serving curl the same page.
So a 403 tells you about the WAF's opinion of the CALLER, never about whether the page exists — it is
reported as BLOCKED (inconclusive) and does not fail the run. Only 404/410/5xx/DNS/timeout are FAILED,
because only those mean the link is actually broken. Check a BLOCKED entry by eye in a browser.
"""
from __future__ import annotations

import argparse
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

sys.path.insert(0, ".")
from app.services.advisor_sources import MARKET_SOURCES  # noqa: E402

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def check(url: str, timeout: int) -> tuple[str, str]:
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    try:
        with urlopen(req, timeout=timeout) as r:  # noqa: S310 — fixed, in-repo URLs only
            return ("OK", str(r.status))
    except HTTPError as e:
        if e.code in (401, 403):  # the WAF's opinion of the caller, not evidence about the page
            return ("BLOCKED", f"{e.code} — WAF/bot block, verify by eye")
        return ("FAILED", str(e.code))
    except (URLError, OSError) as e:
        return ("FAILED", str(getattr(e, "reason", e))[:60])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout", type=int, default=20)
    args = ap.parse_args()

    failed = blocked = 0
    for key, (label, url, _purpose) in MARKET_SOURCES.items():
        status, detail = check(url, args.timeout)
        failed += status == "FAILED"
        blocked += status == "BLOCKED"
        print(f"{status:<8} {key:<20} {url:<45} {detail}")
        if status == "FAILED":
            print(f"         ^ shown to users as: {label}")

    total = len(MARKET_SOURCES)
    print(f"\n{total - failed - blocked}/{total} reachable · {blocked} WAF-blocked · {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
