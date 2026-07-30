"""Canonical domain vocabulary, loaded from the generated contract.

The Rust ingestion worker owns the vocabulary (`domain_vocabulary.rs`) because it owns the writes. This
module is the read side: it loads the generated manifest so both tiers share ONE list instead of two
hand-maintained ones that drift.

WHY THIS EXISTS
---------------
The worker writes `domain: "financial"`. The planner emitted `"finance"`. Nothing reconciled them, so
`{"key": "domain", "match": {"value": "finance"}}` matched zero of the 1,583 financial points in
production — 71% of the corpus, silently. `vector_seeds: 0` is indistinguishable from "user has no
data", which is why it survived so long.

FAIL LOUDLY, NEVER SILENTLY
---------------------------
`normalize_domain` returns None for an unrecognised value rather than passing it through. A filter on a
string no writer ever produces returns nothing and reports success — the exact failure mode this repairs.
Callers must treat None as "do not filter" plus a logged warning, never as "filter on the raw value".
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger("core.graphrag.domains")

_MANIFEST_PATH = Path(__file__).with_name("domain_manifest.json")


def _load() -> tuple[frozenset[str], dict[str, str]]:
    """Read the generated domain contract.

    Fails loudly if missing. A built-in fallback list would recreate the original bug: a second
    vocabulary that looks authoritative and silently disagrees with what is actually stored.
    """
    try:
        data = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
        canonical = frozenset(data["canonical"])
        aliases = {str(k).lower(): str(v) for k, v in data["aliases"].items()}
        if not canonical:
            raise ValueError("domain manifest declares no canonical domains")
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"domain manifest unreadable at {_MANIFEST_PATH}: {exc}. Regenerate with: "
            "cargo test -p ingestion-worker export_domain_manifest -- --ignored"
        ) from exc
    return canonical, aliases


CANONICAL_DOMAINS, DOMAIN_ALIASES = _load()

#: Counters for alias use, surfaced through structured logs/metrics. Alias traffic dropping to zero is
#: the removal criterion for the compatibility layer (see DOMAIN_VOCABULARY_CONTRACT.md).
_alias_hits: dict[str, int] = {}


def alias_usage() -> dict[str, int]:
    """Observed alias normalizations since process start. Safe to emit as a metric — keys only."""
    return dict(_alias_hits)


def normalize_domain(raw: Optional[str]) -> Optional[str]:
    """Rewrite a domain value to canonical form, or None if unrecognised.

    None means "not a domain we store" — the caller must drop the filter rather than apply a filter that
    cannot match. Silent pass-through is what made the original defect invisible.
    """
    if not raw:
        return None
    lowered = str(raw).strip().lower()
    if not lowered:
        return None
    if lowered in CANONICAL_DOMAINS:
        return lowered
    canon = DOMAIN_ALIASES.get(lowered)
    if canon is not None:
        _alias_hits[lowered] = _alias_hits.get(lowered, 0) + 1
        # Structured and safe: a domain key is not user content.
        log.info("domain_alias_normalized alias=%s canonical=%s", lowered, canon)
        return canon
    log.warning(
        "unknown_domain_value value=%r — no writer produces this domain; the filter would match "
        "nothing, so it is being dropped rather than applied",
        lowered,
    )
    return None


def is_canonical(value: str) -> bool:
    return value in CANONICAL_DOMAINS
