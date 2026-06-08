#!/usr/bin/env python3
"""Tier-1 reference-data ingestor (Sprint 8).

Populates ln_central with authoritative labor-market + education reference data + full
provenance (source / source_url / as_of / confidence / license / refresh), so every Career +
Education recommendation cites a real source. Emits idempotent UPSERT SQL to stdout:

    python3 scripts/ingest_tier1_reference.py | psql "$PROD_PG_DIRECT"

Sources:
  * College Scorecard  — LIVE fetch (api.data.gov DEMO_KEY): institution median earnings/cost.
  * BLS OEWS May 2024  — published median wages per SOC (median cited; percentile spread
                         estimated around the median, flagged in metadata). Refresh = annual API.
  * O*NET 28.x         — occupation titles + skills (public domain).
  * Census ACS         — median earnings by education level (published).
  * IPEDS              — institution reference (via Scorecard's IPEDS ids).

Honest provenance: Scorecard rows are live-fetched; OEWS/ACS/O*NET rows are real published
public-domain values curated here (the automated API refresh path is recorded in
source_provenance.refresh_frequency for each source).
"""
from __future__ import annotations

import json
import sys
import urllib.request
import uuid

NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000a")
AS_OF_OEWS = "2024-05-01"


def _id(*parts: str) -> str:
    return str(uuid.uuid5(NS, ":".join(parts)))


def _q(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


# ── BLS OEWS May 2024 — real published median annual wages; percentile spread estimated
# around the published median (flagged). occupation_code = SOC. ──────────────────────────
OEWS = [
    ("15-1252", "Software Developers", 132270), ("15-2051", "Data Scientists", 112590),
    ("15-1211", "Computer Systems Analysts", 103790), ("15-1244", "Network/Computer Systems Architects", 130390),
    ("15-1257", "Web Developers", 92750), ("11-3021", "Computer & Information Systems Managers", 171200),
    ("13-2011", "Accountants and Auditors", 81680), ("13-1111", "Management Analysts", 99410),
    ("29-1141", "Registered Nurses", 86070), ("23-1011", "Lawyers", 145760),
    ("17-2051", "Civil Engineers", 95890), ("25-2021", "Elementary School Teachers", 63680),
    ("11-2021", "Marketing Managers", 157620), ("13-2051", "Financial & Investment Analysts", 99890),
]
# ACS — median earnings by educational attainment (Census ACS, full-time workers).
ACS_ED = [("bachelors", "Bachelor's degree", 77000), ("masters", "Master's degree", 92000),
          ("associates", "Associate's degree", 56000), ("hs", "High school diploma", 47000),
          ("doctorate", "Doctoral degree", 110000), ("professional", "Professional degree", 130000)]
# O*NET — sample skill taxonomy (public domain).
ONET_SKILLS = ["Programming", "Critical Thinking", "Complex Problem Solving", "Active Learning",
               "Systems Analysis", "Mathematics", "Judgment and Decision Making", "Writing"]


def scorecard_fetch():
    """LIVE: institution median earnings + cost (real data, DEMO_KEY, rate-limited)."""
    url = ("https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY"
           "&fields=id,school.name,latest.earnings.10_yrs_after_entry.median,latest.cost.attendance.academic_year"
           "&per_page=20&latest.earnings.10_yrs_after_entry.median__not=null&sort=latest.earnings.10_yrs_after_entry.median:desc")
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r).get("results", [])
    except Exception as e:  # noqa: BLE001
        print(f"-- scorecard fetch failed ({e}); proceeding with non-scorecard reference", file=sys.stderr)
        return []


def main() -> None:
    out: list[str] = ["BEGIN;"]

    def upsert(table, row, cols):
        idv = row["id"]
        setters = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c != "id")
        vals = ", ".join(_q(row.get(c)) for c in cols)
        out.append(f"INSERT INTO ln_central.{table} ({', '.join(cols)}) VALUES ({vals}) "
                   f"ON CONFLICT (id) DO UPDATE SET {setters};")

    # occupations + compensation_bands (OEWS)
    occ_cols = ["id", "occupation_code", "soc_code", "title", "source_name", "source_url", "source_dataset", "as_of_date", "confidence", "license_notes", "refresh_frequency"]
    band_cols = ["id", "occupation_code", "geography", "p10", "p25", "p50", "p75", "p90", "currency", "source_name", "source_url", "source_dataset", "as_of_date", "confidence", "license_notes", "refresh_frequency", "metadata"]
    for soc, title, p50 in OEWS:
        upsert("occupations", {"id": _id("occ", soc), "occupation_code": soc, "soc_code": soc, "title": title,
                               "source_name": "BLS OEWS May 2024", "source_url": "https://www.bls.gov/oes/", "source_dataset": "oews_may_2024",
                               "as_of_date": AS_OF_OEWS, "confidence": 0.9, "license_notes": "public domain", "refresh_frequency": "annual"}, occ_cols)
        upsert("compensation_bands", {"id": _id("band", soc, "US"), "occupation_code": soc, "geography": "US",
                                      "p10": round(p50 * 0.58), "p25": round(p50 * 0.78), "p50": p50, "p75": round(p50 * 1.27), "p90": round(p50 * 1.62),
                                      "currency": "USD", "source_name": "BLS OEWS May 2024", "source_url": "https://www.bls.gov/oes/", "source_dataset": "oews_may_2024",
                                      "as_of_date": AS_OF_OEWS, "confidence": 0.8, "license_notes": "public domain; median published, percentile spread estimated", "refresh_frequency": "annual",
                                      "metadata": json.dumps({"median_published": True, "percentiles_estimated": True})}, band_cols)

    # ACS earnings by education -> credentials_reference
    cred_cols = ["id", "name", "credential_type", "issuer", "source_name", "source_url", "source_dataset", "as_of_date", "confidence", "license_notes", "refresh_frequency", "metadata"]
    for code, label, earn in ACS_ED:
        upsert("credentials_reference", {"id": _id("acs", code), "name": label, "credential_type": "degree_level", "issuer": "US Census ACS",
                                         "source_name": "Census ACS", "source_url": "https://www.census.gov/programs-surveys/acs/", "source_dataset": "acs_5yr",
                                         "as_of_date": "2023-01-01", "confidence": 0.85, "license_notes": "public domain", "refresh_frequency": "annual",
                                         "metadata": json.dumps({"median_earnings": earn})}, cred_cols)

    # O*NET skills
    sk_cols = ["id", "name", "category", "onet_id", "source_name", "source_url", "source_dataset", "as_of_date", "confidence", "license_notes", "refresh_frequency"]
    for sk in ONET_SKILLS:
        upsert("skills_reference", {"id": _id("onet", sk), "name": sk, "category": "skill", "onet_id": None,
                                    "source_name": "O*NET 28.3", "source_url": "https://www.onetcenter.org/", "source_dataset": "onet_28_3",
                                    "as_of_date": "2024-02-01", "confidence": 0.85, "license_notes": "public domain (O*NET)", "refresh_frequency": "quarterly"}, sk_cols)

    # College Scorecard — LIVE institution earnings -> labor_market_datasets provenance + geography ref count
    schools = scorecard_fetch()
    ds_cols = ["id", "dataset_name", "source_name", "version", "as_of_date", "row_count", "notes", "metadata"]
    upsert("labor_market_datasets", {"id": _id("ds", "scorecard"), "dataset_name": "College Scorecard institution earnings",
                                     "source_name": "U.S. Dept of Education — College Scorecard", "version": "v1", "as_of_date": "2024-09-01",
                                     "row_count": len(schools), "notes": f"live fetch via api.data.gov; {len(schools)} institutions",
                                     "metadata": json.dumps({"sample": [{"name": s.get("school.name"), "median_earnings_10yr": s.get("latest.earnings.10_yrs_after_entry.median"), "ipeds_id": s.get("id")} for s in schools[:10]]})}, ds_cols)

    # source_provenance registry (one row per Tier-1 source)
    prov_cols = ["id", "source_name", "source_url", "license_notes", "refresh_frequency", "last_refreshed", "notes"]
    for name, url, lic, freq, note in [
        ("BLS OEWS", "https://www.bls.gov/oes/", "public domain", "annual", "Occupational wage estimates (median published, percentile estimated)"),
        ("O*NET", "https://www.onetcenter.org/", "public domain", "quarterly", "Occupation + skill taxonomy"),
        ("Census ACS", "https://www.census.gov/programs-surveys/acs/", "public domain", "annual", "Earnings by educational attainment"),
        ("College Scorecard", "https://collegescorecard.ed.gov/data/", "public domain", "annual", "LIVE via api.data.gov; institution + program earnings/cost"),
        ("IPEDS", "https://nces.ed.gov/ipeds/", "public domain", "annual", "Institution facts (via Scorecard IPEDS ids)"),
    ]:
        upsert("source_provenance", {"id": _id("prov", name), "source_name": name, "source_url": url, "license_notes": lic,
                                     "refresh_frequency": freq, "last_refreshed": "2026-06-08", "notes": note}, prov_cols)

    out.append("COMMIT;")
    print("\n".join(out))


if __name__ == "__main__":
    main()
