"""CI contract enforcement — the required-check manifest must match reality.

A required status check is identified by its **display name**. Renaming a job silently detaches it
from branch protection: the rule keeps waiting for a check that will never report, or (worse, if the
rule is later relaxed) the protection quietly stops covering anything.

These tests make the manifest and the workflows fail together rather than drift apart.

Manifest: artifacts/ci/required_checks.json
Docs:     docs/beta/REQUIRED_CHECKS.md
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

try:
    import yaml
except ImportError:  # pragma: no cover
    pytest.skip("pyyaml unavailable", allow_module_level=True)

REPO = Path(__file__).resolve().parents[3]
WORKFLOWS = REPO / ".github" / "workflows"
MANIFEST = REPO / "artifacts" / "ci" / "required_checks.json"


def _manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def _workflow(name: str) -> dict:
    return yaml.safe_load((WORKFLOWS / name).read_text(encoding="utf-8"))


def _job(workflow: str, job_id: str) -> dict:
    jobs = _workflow(workflow).get("jobs") or {}
    assert job_id in jobs, f"job '{job_id}' no longer exists in {workflow}"
    return jobs[job_id]


def _display_name(workflow: str, job_id: str) -> str:
    """GitHub reports `name:` if present, else the job id."""
    return _job(workflow, job_id).get("name", job_id)


# ── the manifest is real ─────────────────────────────────────────────────────────────────────────

def test_manifest_is_wellformed():
    m = _manifest()
    assert m["required"], "no required checks declared"
    assert m["branch_protection_active"] is False, (
        "branch_protection_active may only be set true with admin-side evidence; it cannot be "
        "claimed from the repository"
    )


@pytest.mark.parametrize("entry", _manifest()["required"], ids=lambda e: e["check"])
def test_every_required_check_exists_with_the_declared_name(entry):
    """A renamed or removed required job detaches branch protection. Fail loudly instead."""
    actual = _display_name(entry["workflow"], entry["job"])
    assert actual == entry["check"], (
        f"Required check name drift in {entry['workflow']}:{entry['job']}.\n"
        f"  branch protection expects: {entry['check']!r}\n"
        f"  workflow now reports:      {actual!r}\n"
        "Renaming a required job silently detaches it from branch protection. Update the manifest "
        "AND the branch-protection rule together, or revert the rename."
    )


@pytest.mark.parametrize("entry", _manifest()["required"], ids=lambda e: e["check"])
def test_required_checks_are_not_conditional(entry):
    """A required check that can skip creates an ambiguous merge state.

    Jobs legitimately declared conditional belong in `recommended_not_required`, not `required`.
    """
    job = _job(entry["workflow"], entry["job"])
    assert "if" not in job, (
        f"{entry['check']} acquired an `if:` guard and can now skip. A skippable required check "
        "either blocks merges forever or silently stops protecting. Move it to "
        "recommended_not_required, or remove the condition."
    )


@pytest.mark.parametrize(
    "entry", [e for e in _manifest()["required"] if not e.get("needs_secrets")],
    ids=lambda e: e["check"],
)
def test_required_checks_do_not_acquire_secret_dependencies(entry):
    """A required check that needs secrets cannot pass on a fork PR — it becomes a merge wall."""
    job = _job(entry["workflow"], entry["job"])
    assert "secrets." not in str(job), (
        f"{entry['check']} now references secrets but is declared needs_secrets=false. Either "
        "update the manifest deliberately or remove the dependency."
    )


# ── the invariant gate specifically ──────────────────────────────────────────────────────────────

def test_architectural_invariants_job_is_unconditional_and_secretless():
    """The invariant gate is the one check that must never skip.

    It enforces tenant binding. A path filter on it would mean a cross-tenant regression introduced
    by a change outside core-api goes unchecked.
    """
    job = _job("ci.yml", "architectural-invariants")
    assert "if" not in job, "the invariant gate must never be conditional"
    assert "needs" not in job, "the invariant gate must not depend on another job that could skip"
    assert "secrets." not in str(job), "the invariant gate must run on fork PRs"


# ── supply chain ─────────────────────────────────────────────────────────────────────────────────

_MUTABLE_REF = re.compile(r"@(main|master|stable|latest)$")


def test_known_unpinned_actions_are_declared_not_discovered():
    """Third-party actions on mutable refs execute whatever upstream pushes next.

    This does not fail the build today — the offenders predate this gate and pinning them is a
    separate, reviewable change. It fails if a NEW one appears, so the set cannot grow silently.
    """
    known = {
        "trufflesecurity/trufflehog@main",
        "superfly/flyctl-actions/setup-flyctl@master",
        "dtolnay/rust-toolchain@stable",
    }
    found = set()
    for wf in WORKFLOWS.glob("*.yml"):
        for line in wf.read_text(encoding="utf-8").splitlines():
            s = line.strip().lstrip("- ").strip()
            if s.startswith("uses:"):
                ref = s.split("uses:", 1)[1].strip()
                if not ref.startswith("./") and _MUTABLE_REF.search(ref):
                    found.add(ref)
    new = found - known
    assert not new, (
        f"New third-party action(s) on a MUTABLE ref: {sorted(new)}. A compromised upstream would "
        "execute in CI with repository access on the next run. Pin to a commit SHA."
    )
    gone = known - found
    assert not gone, f"Pinned upstream(s) fixed — remove from `known`: {sorted(gone)} (gap CI-1)"


def test_workflows_declare_explicit_permissions():
    """Least privilege for GITHUB_TOKEN.

    Declared as a known gap (CI-3) rather than a hard failure for workflows that predate it, so the
    set cannot grow.
    """
    missing = {
        wf.name for wf in WORKFLOWS.glob("*.yml")
        if "permissions" not in (yaml.safe_load(wf.read_text(encoding="utf-8")) or {})
    }
    assert missing <= {"ci.yml", "security-audit.yml"}, (
        f"New workflow(s) without explicit permissions: {sorted(missing - {'ci.yml', 'security-audit.yml'})}. "
        "Declare `permissions:` explicitly — the repository default may grant write scopes."
    )


# ── owning-path coverage ─────────────────────────────────────────────────────────────────────────

def test_manifest_path_is_covered_by_the_worker_filter():
    """The generated manifest is owned by the Rust registry but ships inside core-api.

    Without this path in the worker filter, hand-editing the manifest would skip the only check that
    can catch the divergence (`manifest_on_disk_matches_the_registry`).
    """
    raw = (WORKFLOWS / "deploy-fly.yml").read_text(encoding="utf-8")
    assert "app/grounding/semantic/ontology_manifest.json" in raw, (
        "the generated manifest path left the ingestion-worker path filter — manifest drift would "
        "no longer be caught (gap CI-2)"
    )
