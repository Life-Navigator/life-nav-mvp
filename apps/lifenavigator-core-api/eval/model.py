"""Evaluation harness — fixtures, outcomes, and the vocabulary the probes share.

WHAT THIS HARNESS IS
--------------------
Dev and CI tooling. It imports the production services and calls them with fixed cases. It is NOT in
the live request path: no router touches it, nothing in `dependencies.py` constructs it, and deleting
the whole `eval/` tree leaves production byte-identical.

It sits BENEATH the existing `apps/web/advisor-eval.mjs`, which drives the deployed advisor with real
Supabase users and real model spend. That one answers "is the deployed system trustworthy?" — good,
but it measures the whole pipeline at once, needs a deployment, and costs money per run, so it cannot
tell you WHICH component moved a score. This harness answers "did this change help, and what
changed?" by probing one stage at a time.

WHY THE TWO-SIDED LABELLING MATTERS MORE THAN ANYTHING ELSE HERE
---------------------------------------------------------------
Every case declares which way it must go, and the two directions are NEVER averaged into one number:

    must_pass   — a legitimate answer. Blocking it is a QUALITY failure (the user loses a real
                  answer, or a true sentence is deleted from it).
    must_block  — a fabricated claim about the user's money. Letting it through is a TRUST failure.

A gate that blocks everything scores perfectly on trust and is useless. A gate that passes
everything scores perfectly on quality and is dangerous. One aggregate score lets either failure
hide inside the other, so the scorecard always reports them separately and CI gates on both.

KNOWN DIVERGENCE
----------------
Some cases are labelled with the behaviour the trust policy INTENDS, not the behaviour the code
currently has. Those carry `known_divergence` with a reason. They still run, they still appear in
the scorecard, and CI does not fail on them — but they are counted and visible, so a known
limitation stays quantified instead of being quietly relabelled as correct. Deleting the annotation
is how you declare one fixed; the case failing again afterwards is then a real regression.
"""
from __future__ import annotations

import json
import pathlib
from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Optional

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
BASELINES = pathlib.Path(__file__).parent / "baselines"
RECORDINGS = pathlib.Path(__file__).parent / "recordings"

Direction = Literal["must_pass", "must_block"]

# A probe whose fixture set is empty reports UNMEASURED. It never reports 0 failures or PASS —
# "nothing ran" and "everything passed" must not look alike. Same discipline as the beta gate table
# and as `cost_known` in the token ledger.
UNMEASURED = "UNMEASURED"


@dataclass(frozen=True)
class GateCase:
    """One (reply, context) pair with the verdict the trust policy requires.

    `allowed` / `scenario` are the validator's Tier 1 and Tier 3 number sets — the same two sets
    `advisor_context` populates in production, so a case is a faithful snapshot of a real turn's
    grounding rather than an approximation of it.
    """

    id: str
    text: str
    direction: Direction
    allowed: tuple[str, ...] = ()
    scenario: tuple[str, ...] = ()
    why: str = ""
    known_divergence: str = ""     # non-empty ⇒ expected to fail today, for this stated reason
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class RoutingCase:
    """A message with the domain/risk a correct router must produce."""

    id: str
    message: str
    expect_domain: str
    expect_risk: Optional[str] = None       # None ⇒ don't assert risk for this case
    expect_urgent: Optional[str] = None     # the health-urgent indicator, when one is required
    why: str = ""
    known_divergence: str = ""
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class RetrievalCase:
    """A query plus the edges a correct retrieval MUST surface for a given user.

    `relevant_edge_ids` is a human relevance judgement. There is no way to generate it honestly from
    the graph itself — if the system could decide what was relevant, there would be nothing to
    measure. This is why the retrieval eval set does not exist yet: it is labelling effort, not code.
    `fly.toml` names "a measured win on the retrieval eval set" as the condition for enabling graph
    grounding, so until these are authored that flag cannot be flipped on evidence.
    """

    id: str
    user_id: str
    query: str
    relevant_edge_ids: tuple[str, ...] = ()
    irrelevant_edge_ids: tuple[str, ...] = ()   # must NOT come back — guards against dragnet recall
    domain: Optional[str] = None
    why: str = ""
    labelled: bool = False                      # False ⇒ a stub; the probe refuses to score it


@dataclass
class CaseResult:
    """What one case did, and whether that is what it had to do."""

    case_id: str
    direction: str
    expected: str
    actual: str
    ok: bool
    known_divergence: str = ""
    detail: dict[str, Any] = field(default_factory=dict)
    # A case that could not be SCORED at all — e.g. a retrieval case with no relevance labels, or
    # one needing a live store that was not supplied. Distinct from a case that was scored and
    # failed, and excluded from every rate.
    #
    # Without this the retrieval probe reported "MEASURED, over-block 100%" for four unlabelled
    # stubs: a refusal to score was being counted as four quality failures. That is the exact
    # confusion this harness is supposed to prevent, so the distinction is structural, not a label.
    refused: bool = False

    @property
    def counts_against_us(self) -> bool:
        """A failure only counts when it was scoreable and is not an annotated known divergence."""
        return (not self.ok) and not self.known_divergence and not self.refused


def load_gate_cases(path: Optional[pathlib.Path] = None) -> list[GateCase]:
    raw = _load(path or FIXTURES / "gate_cases.json")
    return [GateCase(
        id=c["id"], text=c["text"], direction=c["direction"],
        allowed=tuple(c.get("allowed") or ()), scenario=tuple(c.get("scenario") or ()),
        why=c.get("why", ""), known_divergence=c.get("known_divergence", ""),
        tags=tuple(c.get("tags") or ()),
    ) for c in raw]


def load_routing_cases(path: Optional[pathlib.Path] = None) -> list[RoutingCase]:
    raw = _load(path or FIXTURES / "routing_cases.json")
    return [RoutingCase(
        id=c["id"], message=c["message"], expect_domain=c["expect_domain"],
        expect_risk=c.get("expect_risk"), expect_urgent=c.get("expect_urgent"),
        why=c.get("why", ""), known_divergence=c.get("known_divergence", ""),
        tags=tuple(c.get("tags") or ()),
    ) for c in raw]


def load_retrieval_cases(path: Optional[pathlib.Path] = None) -> list[RetrievalCase]:
    raw = _load(path or FIXTURES / "retrieval_cases.json")
    return [RetrievalCase(
        id=c["id"], user_id=c["user_id"], query=c["query"],
        relevant_edge_ids=tuple(c.get("relevant_edge_ids") or ()),
        irrelevant_edge_ids=tuple(c.get("irrelevant_edge_ids") or ()),
        domain=c.get("domain"), why=c.get("why", ""), labelled=bool(c.get("labelled")),
    ) for c in raw]


def _load(path: pathlib.Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    doc = json.loads(path.read_text())
    # Fixtures are versioned so a scorecard can state WHICH case set produced it. Comparing a score
    # against a baseline built from a different fixture set is meaningless, and silently doing so is
    # how an eval starts reporting progress that is really just an easier question.
    return list(doc.get("cases") or [])


def fixture_version(name: str) -> str:
    path = FIXTURES / name
    if not path.exists():
        return "absent"
    doc = json.loads(path.read_text())
    return str(doc.get("version") or "unversioned")


def dump(obj: Any) -> dict[str, Any]:
    return asdict(obj) if hasattr(obj, "__dataclass_fields__") else obj
