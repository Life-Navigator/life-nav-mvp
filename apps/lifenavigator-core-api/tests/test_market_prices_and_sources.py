"""Market prices and verification links — the advisor may say what things COST, in an honest form, and hand
the user somewhere to check it.

The two failure modes this locks:
  1. A market price stated as an exact figure ($400) — a precision claim we have no standing to make. It is
     NOT deleted (that's what made the advisor useless); it is sent back to be rewritten as a range.
  2. A hallucinated URL. The model picks a KEY from a server-owned catalog and never writes a link, so an
     invented source is structurally impossible rather than merely discouraged.
"""
import pytest

from app.services.advisor_sources import MARKET_SOURCES, prompt_block
from app.services.advisor_sources import resolve as resolve_sources
from app.services.advisor_validator import classify_issues


class _Ctx:
    def __init__(self, nums=()):
        self.allowed_numbers = set(nums)
        self.connected_pairs = set()
        self.candidate_goals = []
        self.primary_objective = ""


def _issues(text, nums=()):
    return classify_issues({"recommendation": text}, _Ctx(nums))


# ---------------------------------------------------------------- market price form

@pytest.mark.parametrize("text", [
    "A home inspection runs $400.",
    "Estate attorneys charge $1,500 for a simple will.",
    "The appraisal costs $650.",
])
def test_unhedged_market_price_is_repaired_not_deleted(text):
    """The number is welcome; the false precision isn't. The instruction must say KEEP and rephrase — if it
    said 'remove', the repair loop would strip the concrete detail that makes advice actionable, which is
    the exact over-blocking WS-B set out to end."""
    issues = _issues(text)
    assert {i["type"] for i in issues} == {"unhedged_market_price"}, issues
    note = issues[0]["repair_instruction"].lower()
    assert "keep" in note and "range" in note
    assert "remove" not in note and "delete" not in note.replace("don't delete", "")


@pytest.mark.parametrize("text", [
    "A home inspection runs about $400-600.",
    "Estate attorneys typically charge $1,500 to $3,000 for a simple will.",
    "Closing costs are usually 2-5% of the purchase price.",
])
def test_honest_market_price_raises_nothing(text):
    assert _issues(text) == [], _issues(text)


def test_market_price_repair_does_not_apply_to_the_users_own_money():
    """A possessive figure is a PERSONAL claim — it needs a source, not a range. Hedging it must never be
    offered as the fix, or the repair loop would launder a fabrication into an 'estimate'."""
    issues = _issues("Your closing costs will be $9,500.")
    types = {i["type"] for i in issues}
    assert "unhedged_market_price" not in types
    assert types & {"unsupported_personal_number", "fabricated_number"}


# ---------------------------------------------------------------- sources

def test_resolve_keeps_known_keys_and_owns_the_url():
    out = resolve_sources([{"key": "consumer_finance", "for": "closing cost ranges"}])
    assert out == [{
        "key": "consumer_finance",
        "label": MARKET_SOURCES["consumer_finance"][0],
        "url": MARKET_SOURCES["consumer_finance"][1],
        "for": "closing cost ranges",
    }]


@pytest.mark.parametrize("raw", [
    [{"key": "totally_made_up"}],                                   # invented key
    [{"url": "https://example.com/rates"}],                         # smuggled URL, no key
    [{"key": "https://consumerfinance.gov"}],                       # URL in the key slot
    ["consumer_finance"],                                           # wrong shape
    None,
    "consumer_finance",
])
def test_resolve_drops_anything_it_does_not_own(raw):
    assert resolve_sources(raw) == []


def test_resolve_dedupes_and_preserves_order():
    out = resolve_sources([{"key": "irs"}, {"key": "consumer_finance"}, {"key": "irs"}])
    assert [s["key"] for s in out] == ["irs", "consumer_finance"]


def test_every_catalog_url_is_a_plausible_https_root():
    """A deep path is what rots. Entries stay root-ish so the link outlives the next site redesign."""
    for key, (label, url, purpose) in MARKET_SOURCES.items():
        assert url.startswith("https://"), key
        assert label and purpose, key
        assert url.count("/") <= 4, f"{key}: {url} is too deep to stay alive"


def test_prompt_block_lists_every_key():
    block = prompt_block()
    for key in MARKET_SOURCES:
        assert key in block
