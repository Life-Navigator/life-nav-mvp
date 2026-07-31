# Invariant CI Updates — Sprint 1

**Date:** 2026-07-30 · One job added. No existing job modified, weakened, or removed.

---

## 1. Change

`.github/workflows/ci.yml` — new job `architectural-invariants`, inserted before `validate-ontology`.

```yaml
architectural-invariants:
  name: Architectural Invariants
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: apps/lifenavigator-core-api
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
        cache: pip
        cache-dependency-path: apps/lifenavigator-core-api/requirements-dev.txt
    - run: pip install -r requirements.txt -r requirements-dev.txt
    - name: Enforce architectural invariants
      run: python -m pytest tests/test_architectural_invariants.py -q
```

Validated: `yaml.safe_load` parses; the job has **no `if:` and no `needs:`**.

---

## 2. Why unconditional — the finding that drove placement

The obvious home was `deploy-fly.yml:test-core-api`, which already runs core-api pytest. **It is
path-filtered:**

```yaml
core_api:
  - 'apps/lifenavigator-core-api/**'
```

Placed there, the invariant tests would run **only when core-api changes**. That is wrong for this class
of check:

- **I-10** compares literals against `ontology_manifest.json`, which is owned by the **worker**.
  A worker-side catalog change can invalidate the assumption without touching core-api paths.
- **I-1** asserts a property of the _whole system_ ("Rust is the only writer"). A new write path could
  be introduced in a change whose diff never triggers the core-api filter.
- More generally: **an invariant that runs on some pull requests is not an invariant.** Conditional
  enforcement produces a gate that is green because it did not run — indistinguishable, in the CI
  summary, from a gate that ran and passed. That silent-success shape is the same failure class as
  `domain=finance` returning zero rows and looking healthy.

`ci.yml` also carries the precedent: `verify-governance` and `validate-ontology` are both unconditional
governance gates with no path filter.

---

## 3. Position in the pipeline

| Job                                       | Conditional?            | Purpose                             |
| ----------------------------------------- | ----------------------- | ----------------------------------- |
| `lint`, `typecheck`                       | no                      | style/type                          |
| `verify-governance`                       | no                      | governance coverage (**precedent**) |
| `unit-tests`, `build`, `e2e-tests`        | no                      | web app                             |
| **`architectural-invariants`**            | **no**                  | **system invariants (new)**         |
| `validate-ontology`                       | no                      | ontology files present              |
| `secrets-scan`                            | no                      | gitleaks + TruffleHog               |
| `test-core-api` (deploy-fly.yml)          | **yes** — path-filtered | full core-api suite                 |
| `check-ingestion-worker` (deploy-fly.yml) | **yes** — path-filtered | worker build/test + drift gates     |

The invariant suite therefore runs **twice** when core-api changes (once unconditionally here, once
inside the full suite). That redundancy is intentional and cheap: the unconditional run is the
guarantee; the path-filtered run is incidental.

---

## 4. Cost

~90s: checkout, Python setup with pip cache, dependency install, 14 tests in **0.32s**. The install
dominates. Acceptable for an unconditional job; if it becomes a bottleneck the correct fix is a cached
venv, **not** re-adding a path filter.

---

## 5. Failure behaviour

Any invariant failure fails the job and blocks the PR. The assertion messages name the invariant, the
regression caught, and the downstream consequence — for example:

> Write Cypher found in core-api. The Rust ingestion worker is the only sanctioned graph writer
> (invariant I-1). Adding a Python write path breaks ADR-002's provenance guarantee.

**A failure here is never fixed by relaxing the test.** It is an architectural amendment and follows the
ADR process.

---

## 6. Not changed

| Item                          | Why                                                                     |
| ----------------------------- | ----------------------------------------------------------------------- |
| `deploy-fly.yml` path filters | Correct for app-scoped suites; only invariants need to be unconditional |
| `secrets-scan`                | Out of scope; the canary requirement belongs to ADR-007                 |
| `check-ingestion-worker`      | Rust drift gates already unconditional within their filter and passing  |
| Branch protection rules       | Requires repository admin; **see §7**                                   |

---

## 7. Required follow-up (cannot be done from the repository)

**The new job must be added to the branch-protection required-status-checks list**, or it will run and
report without blocking a merge. A gate that reports but does not block is advisory, not enforcing.

- Owner: repository admin
- Evidence required: branch protection showing `Architectural Invariants` as required
- Until then, status is **Implemented**, not **Operationally observed**

The job has also **never executed in GitHub Actions** — the branch is unpushed. First execution is the
evidence that moves it to _Verified_.
