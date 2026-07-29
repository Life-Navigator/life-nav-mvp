# Credential Incident Report — Beta Synthetic Account Password

**Incident ID:** LN-SEC-2026-0729-01
**Opened:** 2026-07-28 · **Contained:** 2026-07-29
**Severity:** **Medium** (capped — synthetic accounts, no real user data). Would be **Critical** if the
affected accounts held production user records.
**Status:** ✅ **CONTAINED** — old credential verified unusable. ⚠️ **Git history remediation PENDING
APPROVAL.**
**Author:** Lead Principal Engineer (incident response)

> **Redaction policy for this document.** The exposed value is never reproduced. It appears throughout as
> `[REDACTED-ROTATED-2026-07-28]` — the same marker written into the redacted files. Replacement secrets are
> not recorded here, in any repository file, or in any chat/terminal output. Commands below are shown
> exactly as run, with the value substituted by a shell variable.

---

## 1. Incident Summary

A shared password for five synthetic beta accounts was committed to the repository as a **hardcoded default
to an environment-variable lookup** in `scripts/beta/verify_synthetic_accounts.py`, and separately quoted in
`docs/beta/FIRST5_GO_NOGO.md`.

```python
# the committed line (value redacted)
PW = os.environ.get("BETA_GATE_PW", "[REDACTED-ROTATED-2026-07-28]")
```

The credential **authenticated successfully against the live production Supabase project** at the time of
discovery. It was valid for approximately **30 days** (2026-06-29 → 2026-07-29) and is present in
**`origin/main`** and ~30 other local and remote branches.

**How it was found.** During an unrelated technical due-diligence review, the reviewer read the script,
observed the hardcoded default, and tested it against the live project — it worked. The value was then
written into an untracked audit report (`SECURITY_AUDIT.md`), which is what prompted this containment
exercise. **The audit report was the least significant exposure**: the credential had already been in shared
git history for a month.

**Why existing controls did not catch it.** CI has run a secret-scanning job on every commit for months:

```yaml
- uses: trufflesecurity/trufflehog@main
  with:
    extra_args: --only-verified
```

`--only-verified` reports a secret **only when the scanner can verify it against a provider API** (AWS,
GitHub, Stripe, …). A generic application password for our _own_ Supabase project has no provider verifier,
so it was invisible to that scan **by design**. The control was functioning exactly as configured and still
missed a live production credential for 30 days. This is the single most important lesson in this report.

**Aggravating factor.** The script does not merely _use_ the password — it **creates the accounts with it**
(`{"email": email, "password": PW, "email_confirm": True, ...}`). A hardcoded default on that line is not a
placeholder; it is the credential the production accounts are provisioned with.

---

## 2. Scope

### Affected identities

| Identity                         | System                       | Data classification | Real user data? |
| -------------------------------- | ---------------------------- | ------------------- | --------------- |
| `beta1@lifenav-beta.example.com` | Supabase Auth (prod project) | Synthetic persona   | No              |
| `beta2@lifenav-beta.example.com` | Supabase Auth (prod project) | Synthetic persona   | No              |
| `beta3@lifenav-beta.example.com` | Supabase Auth (prod project) | Synthetic persona   | No              |
| `beta4@lifenav-beta.example.com` | Supabase Auth (prod project) | Synthetic persona   | No              |
| `beta5@lifenav-beta.example.com` | Supabase Auth (prod project) | Synthetic persona   | No              |

All five are `is_synthetic` seeded personas. **No real customer PII, PHI, or financial data was reachable
with this credential.** Severity is capped on that basis and on that basis only — the accounts do live in
the **production** Supabase project alongside real data, so the blast radius depended entirely on RLS
correctness for those accounts. Given the separately-documented finding that the core API bypasses RLS
(`SECURITY_AUDIT.md` HIGH-1), this margin was thinner than it should have been.

### Exposure window

| Event                       | Date         | Commit     |
| --------------------------- | ------------ | ---------- |
| Credential first committed  | 2026-06-29   | `7b01a413` |
| Credential repeated in docs | 2026-07-01   | `829c6a1f` |
| Pushed to `origin/main`     | ≤ 2026-07-01 | —          |
| Discovered                  | 2026-07-28   | —          |
| Rotated & verified dead     | 2026-07-29   | —          |
| **Total window**            | **~30 days** |            |

---

## 3. Exposure Locations

Enumerated per the required categories. Values redacted; only locations recorded.

| #   | Category                      | Location                                    | Tracked?             | Contained value            | Status                   |
| --- | ----------------------------- | ------------------------------------------- | -------------------- | -------------------------- | ------------------------ |
| 1   | Source / test tooling         | `scripts/beta/verify_synthetic_accounts.py` | **Yes — in history** | Hardcoded env fallback     | ✅ Removed, fails closed |
| 2   | Documentation                 | `docs/beta/FIRST5_GO_NOGO.md`               | **Yes — in history** | Quoted in runbook text     | ✅ Redacted              |
| 3   | Security report               | `SECURITY_AUDIT.md`                         | No (untracked)       | Quoted as finding M-1      | ✅ Redacted              |
| 4   | DD report                     | `TECHNICAL_DUE_DILIGENCE.md`                | No (untracked)       | Quoted as evidence         | ✅ Redacted              |
| 5   | Remediation plan              | `REMEDIATION_MASTER_PLAN.md`                | No (untracked)       | 5 occurrences              | ✅ Redacted              |
| 6   | **Git history**               | commits `7b01a413`, `829c6a1f`              | **Yes**              | Both files                 | ⚠️ **PENDING — see §6**  |
| 7   | Git index (staged)            | —                                           | —                    | None                       | ✅ Clean                 |
| 8   | Stashes                       | `stash@{0}`                                 | —                    | None                       | ✅ Clean                 |
| 9   | Reflog (687 commits scanned)  | —                                           | —                    | No unreachable-only copies | ✅ Clean                 |
| 10  | Patches / diffs               | `.git/lint-staged_unstaged.patch`           | No                   | None                       | ✅ Clean                 |
| 11  | Build/turbo logs (9 files)    | `**/.turbo/*.log`                           | No                   | None                       | ✅ Clean                 |
| 12  | Test fixtures                 | —                                           | —                    | None                       | ✅ Clean                 |
| 13  | Deployment config             | `fly.toml` ×3, CI workflows                 | Yes                  | None                       | ✅ Clean                 |
| 14  | `.env*` files (incl. ignored) | —                                           | —                    | None                       | ✅ Clean                 |
| 15  | Generated artifacts           | `.next/`, `target/`, `node_modules/`        | No                   | Not scanned (vendor/build) | ⚠️ See §8 residual R-4   |

**Working-tree occurrences after remediation: 0** (verified — §5).

---

## 4. Containment Actions

Executed in this order. Each is reproducible from the commands in §9.

1. **Captured the value into a shell variable without echoing it**, so no subsequent command, log, or
   transcript reproduces it.
2. **Enumerated all exposure locations** across the 15 categories above before changing anything.
3. **Rotated all five account passwords** via the Supabase Admin API
   (`PUT /auth/v1/admin/users/{id}`). All five returned `200`.
   - **Unique secret per account** (not one shared secret) — compromise of one no longer implies the others.
   - 28 characters, CSPRNG (`secrets.choice`), mixed alphabet ≈ 165 bits of entropy.
4. **Verified the old credential is dead** on all five accounts (§5).
5. **Verified the new credentials work** on all five — proving rotation rather than lockout.
6. **Attempted session/refresh-token revocation** — endpoint returned `404` on this GoTrue version. Recorded
   as residual risk **R-1** with the manual remediation.
7. **Stored new secrets outside the repository**, at
   `<session-scratchpad>/new-beta-credentials.txt`, mode `0600`. **Not committed, not printed.**
8. **Redacted all five files** containing the value (working tree now clean).
9. **Made the script fail closed** — the default is gone; an unset `BETA_GATE_PW` now aborts the run with
   instructions for generating a strong per-run secret.
10. **Added preventive controls** (§7).

---

## 5. Verification That the Old Credential Is Disabled

This is the evidence for the containment claim. Both directions were tested, because "old fails" alone is
also consistent with the accounts being broken.

**Negative test — old credential must be rejected:**

```
POST /auth/v1/token?grant_type=password   (password = $OLD)

  beta1@lifenav-beta.example.com           REJECTED (400)
  beta2@lifenav-beta.example.com           REJECTED (400)
  beta3@lifenav-beta.example.com           REJECTED (400)
  beta4@lifenav-beta.example.com           REJECTED (400)
  beta5@lifenav-beta.example.com           REJECTED (400)
```

**Positive test — new credentials must authenticate (proves rotation, not lockout):**

```
POST /auth/v1/token?grant_type=password   (password = $NEW_<account>)

  beta1@lifenav-beta.example.com           AUTHENTICATED
  beta2@lifenav-beta.example.com           AUTHENTICATED
  beta3@lifenav-beta.example.com           AUTHENTICATED
  beta4@lifenav-beta.example.com           AUTHENTICATED
  beta5@lifenav-beta.example.com           AUTHENTICATED
```

**Working-tree sweep after redaction:**

```
live occurrences in working tree: 0 (target: 0)
```

> **CONTAINMENT VERIFIED (password vector):** the exposed value no longer authenticates against any of the
> five accounts, confirmed by live test rather than by inference from a successful rotation call.
> **This claim is scoped to password authentication.** It does **not** cover pre-existing sessions — see
> residual risk R-1.

---

## 6. Git-History Status — ⚠️ ACTION REQUIRED, NOT TAKEN

**The credential is in shared history and remains there.** Per instruction, no history rewrite was
performed and nothing was force-pushed.

### Affected commits

| Commit     | Date       | Subject                                                                                | File                                        |
| ---------- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| `7b01a413` | 2026-06-29 | `feat(beta): First-5 synthetic account verification gate + synthetic banner`           | `scripts/beta/verify_synthetic_accounts.py` |
| `829c6a1f` | 2026-07-01 | `docs(beta): First-5 GO/NO-GO report — NO-GO on the private-beta env (single blocker)` | `docs/beta/FIRST5_GO_NOGO.md`               |

### Affected refs

Both commits are reachable from **`origin/main`** and from **~30 branches**, local and remote, including:

- `origin/main`, `origin/HEAD`
- 13 local feature branches (`feat/career`, `feat/education`, `feat/mobile`, `feat/health-wellness`,
  `fix/pre-beta-p0-blockers`, `fix/web-test-failures`, `chore/dependabot-vuln-sweep`,
  `archive/graphrag-pipeline`, `feat/advisor-goal-persistence`, `feat/capture-api-postbeta`,
  `feat/ci-cd-fly-deploys`, `feat/education-college-comparison`, `feat/mobile-clean-shell-capture`,
  `fix/dashboard-advisor-mode-and-floating-chat`, plus the current branch)
- ~10 `origin/dependabot/*` branches
- Any developer clone or CI cache created in the last 30 days
- Any GitHub fork, and GitHub's own unreferenced-object storage

### Proposed coordinated remediation plan — **requires explicit approval before execution**

**Recommendation: DO NOT rewrite history for this incident.**

The rationale is deliberate, not lazy:

1. **Rotation has already neutralized the credential.** The value in history is now inert — it authenticates
   to nothing. History rewriting removes a _string_, not a _risk_.
2. **The cost is high and the blast radius is large.** Rewriting requires coordinating ~30 branches, forcing
   every collaborator and CI cache to re-clone, invalidating every open PR, and breaking every commit SHA
   referenced in the 1,042-file docs corpus and in `advisor_turns` telemetry.
3. **It is not fully effective.** GitHub retains unreferenced objects; forks and existing clones are outside
   our control. A rewrite produces a _feeling_ of cleanliness disproportionate to the residual it removes.
4. **Rewriting is itself a risk event.** A botched filter-repo on a repo with this many branches can lose
   work.

**If the owner decides a rewrite is nonetheless required** (e.g. for an external audit or an acquirer's
clean-history requirement), the safe sequence is:

```
Phase A — Prepare (no destructive action)
  1. Announce a freeze; no merges or pushes for the window.
  2. Full backup: `git clone --mirror` to offline storage, verified by object count.
  3. Inventory open PRs and forks; notify all collaborators.
  4. Confirm the credential is already rotated (it is — §5). Rewriting must NEVER be the containment step.

Phase B — Rewrite (single operator, on the mirror first)
  5. `git filter-repo --replace-text <(echo 'literal==>[REDACTED]')`   # run on the mirror
  6. Verify: `git log --all -S"$OLD"` returns nothing; spot-check both files at both commits.
  7. Verify build/tests pass on the rewritten mirror before touching the real remote.

Phase C — Coordinated cutover (REQUIRES EXPLICIT APPROVAL TO FORCE-PUSH)
  8. Force-push all refs during the freeze window.
  9. Every collaborator re-clones. Do NOT rebase old clones onto new history.
 10. Re-open PRs from re-cloned branches.
 11. Ask GitHub Support to garbage-collect unreferenced objects.
 12. Confirm forks are updated or deleted.

Phase D — Verify
 13. Fresh clone; `git log --all -S"$OLD"` returns nothing.
 14. Re-run full CI on the rewritten history.
```

**Nothing in Phase B or C has been executed. No force-push has occurred.**

---

## 7. Preventive Controls Added

All are additive; none change application behavior.

| #   | Control                                 | File                                        | What it does                                                                                                                                                                                               |
| --- | --------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Fail-closed script**                  | `scripts/beta/verify_synthetic_accounts.py` | Default removed. Unset `BETA_GATE_PW` now aborts with generation instructions, so the credential cannot re-enter source                                                                                    |
| 2   | **Gitleaks config**                     | `.gitleaks.toml` (new)                      | Pattern + entropy rules that need no provider verification. Includes a rule for the exact shape that leaked: a hardcoded fallback to an env lookup                                                         |
| 3   | **Pre-commit scanning**                 | `.husky/pre-commit`                         | `gitleaks protect --staged --redact` blocks the commit before the secret can reach history — the last point where removal is free. Warns loudly if gitleaks is absent rather than silently passing         |
| 4   | **CI scanning (the gap that mattered)** | `.github/workflows/ci.yml`                  | Added a Gitleaks job **alongside** TruffleHog. TruffleHog's `--only-verified` is retained for its ~0 false-positive rate; Gitleaks covers unverifiable application secrets, which is the class that leaked |
| 5   | **`.gitignore` hardening**              | `.gitignore`                                | Patterns for credential files (`*credentials*.txt`, `*-secrets.txt`, `.pat`, …) so an incident-time file cannot be swept in by `git add -A`                                                                |
| 6   | **Documentation rule**                  | this report + script comment                | A hardcoded default IS a committed secret. Recorded at the site where it was violated, not only in a policy doc nobody reads                                                                               |

### Rules for engineers (test fixtures & documentation)

- **Never** write a credential as a default: `os.environ.get("X", "literal")` is a committed secret.
  Use `os.environ["X"]` or fail closed with a helpful message.
- **Test fixtures** must use obviously-fake values that match the allowlist patterns
  (`placeholder`, `example`, `changeme`, `test-…`). Never a value that authenticates anywhere.
- **Documentation and runbooks** must reference _where a secret lives_ (env var name, secret manager path),
  never the value. Runbook exposure (`FIRST5_GO_NOGO.md`) was half of this incident.
- **Scripts that provision accounts** must generate secrets at runtime and print them once to the operator —
  never persist them in the repo.

---

## 8. Unresolved Risks

| ID      | Risk                                                                                                                                                                                                                                                                                                   | Severity                | Status / required action                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R-1** | **Pre-existing sessions may survive rotation.** The admin session-revoke endpoint returned `404` on this GoTrue version, so refresh tokens issued before rotation were not provably invalidated. Anyone holding one may retain access until it expires.                                                | **Medium**              | **Owner action:** revoke via Supabase Dashboard → Auth → Users → _Sign out user_, or SQL: `delete from auth.sessions where user_id in (select id from auth.users where email like '%@lifenav-beta.example.com');` Then re-verify. |
| **R-2** | **Credential remains in shared git history** across `origin/main` + ~30 branches, forks, and clones. Value is inert post-rotation.                                                                                                                                                                     | **Low** (post-rotation) | Decision required: accept (recommended) or execute §6 plan with explicit force-push approval.                                                                                                                                     |
| **R-3** | **Unknown whether the credential was used by an unauthorized party** during the 30-day window. No authentication audit log was reviewed.                                                                                                                                                               | **Unknown**             | **Owner action:** review Supabase auth logs for sign-ins to the five accounts between 2026-06-29 and 2026-07-29 from unexpected IPs. This is the only way to convert R-3 from _unknown_ to _assessed_.                            |
| **R-4** | **Build artifacts and vendor directories were not scanned** (`node_modules/`, `.next/`, `target/`) — excluded for practicality. Low likelihood a beta password appears there.                                                                                                                          | **Low**                 | Optional: scan `.next/` on a clean rebuild.                                                                                                                                                                                       |
| **R-5** | **`gitleaks` is not installed locally**, so the pre-commit hook currently warns instead of blocking.                                                                                                                                                                                                   | **Medium**              | **Owner action:** `brew install gitleaks` / `apt install gitleaks`, then verify the hook blocks a test commit. CI coverage is unaffected.                                                                                         |
| **R-6** | **8 credential-named variables in `apps/web/env-values/prod.env.example`** carry values with no placeholder syntax. Shape analysis found **no** provider-format matches (no `AKIA…`, no JWT, no high-entropy base64) — consistent with instructional placeholders — but this was not confirmed by eye. | **Low**                 | **Owner action:** 2-minute manual review of that file.                                                                                                                                                                            |
| **R-7** | **Rotation is not reflected in the eval/verification tooling.** `verify_synthetic_accounts.py` now requires `BETA_GATE_PW`, but the five accounts have _different_ passwords each. The script's single-password model no longer matches reality.                                                       | **Low** (operational)   | Update the script for per-account secrets, or re-provision with a single strong shared secret if the workflow requires it. Not done here — out of containment scope.                                                              |

---

## 9. Exact Commands Run (secrets redacted)

The exposed value is referenced as `$PAT`, populated without ever being echoed.

```bash
# ── Capture the value without printing it ────────────────────────────────────────────────
PAT=$(grep -oE '"BetaGate[A-Za-z0-9]+"' scripts/beta/verify_synthetic_accounts.py | head -1 | tr -d '"')
echo "pattern captured: length=${#PAT} sha256=$(printf '%s' "$PAT" | sha256sum | cut -c1-16)"
#   → length=18  sha256=eaea28d4035e5656      (fingerprint only — not reversible)

# ── Enumerate exposure (files-only; never prints matching lines) ─────────────────────────
grep -rl --binary-files=without-match "$PAT" . | grep -vE "node_modules|/\.venv/|/\.next/|/target/"
git grep -l "$PAT" -- .
git diff --cached -S"$PAT" --name-only

# ── Git history scope ────────────────────────────────────────────────────────────────────
git log --all --oneline -S"$PAT" --pretty='%h %ad %an %s' --date=short
for c in $(git log --all --format=%H -S"$PAT"); do git branch -a --contains "$c"; done

# ── Stashes, reflog, artifacts ───────────────────────────────────────────────────────────
for s in $(git stash list --format=%gd); do git stash show -p "$s" | grep -q "$PAT" && echo "FOUND in $s"; done
git log -g --all --format=%H | sort -u | wc -l          # 687 reflog commits scanned
find . \( -name "*.patch" -o -name "*.diff" -o -name "*.log" -o -name "*.orig" -o -name "*.bak" \) \
     -not -path "*/node_modules/*" -exec grep -l "$PAT" {} +

# ── Rotation (Supabase Admin API; per-account CSPRNG secrets) ────────────────────────────
#   GET  /auth/v1/admin/users?per_page=200                → resolve the 5 account ids
#   PUT  /auth/v1/admin/users/{id}  {"password": "<28-char CSPRNG, not shown>"}   → 200 ×5
#   secrets written to <scratchpad>/new-beta-credentials.txt (mode 0600, outside the repo)

# ── Verification ─────────────────────────────────────────────────────────────────────────
#   POST /auth/v1/token?grant_type=password  with $PAT      → 400 REJECTED  ×5
#   POST /auth/v1/token?grant_type=password  with new pw    → 200 AUTHENTICATED ×5
#   DELETE /auth/v1/admin/users/{id}/sessions               → 404 (endpoint unavailable → R-1)

# ── Redaction ────────────────────────────────────────────────────────────────────────────
for f in SECURITY_AUDIT.md TECHNICAL_DUE_DILIGENCE.md REMEDIATION_MASTER_PLAN.md docs/beta/FIRST5_GO_NOGO.md; do
  sed -i "s/${PAT}/[REDACTED-ROTATED-2026-07-28]/g" "$f"
done
grep -rl "$PAT" . | grep -vE "node_modules|/\.venv/|/\.next/|/target/|\.git/" | wc -l    # → 0

# ── Secondary credential sweep (multi-method; values never printed) ──────────────────────
#   M1 provider patterns (Google/OpenAI/JWT/Slack/GitHub PAT/private key) → 0 tracked files
#   M2 env-fallback credential shape                                     → 0 (after fix)
#   M3 credential-named literal assignment                               → 11 files, all triaged
#   M4 history pickaxe on BETA_GATE_PW                                   → 1 commit (7b01a413)
#   M5 high-entropy strings in tracked config/docs                       → 274 files (not triaged; R-4)
```

---

## 10. Timeline

| Time               | Event                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-29         | Credential committed in `7b01a413` (hardcoded default)                                                                              |
| 2026-07-01         | Repeated in runbook, `829c6a1f`; both reach `origin/main`                                                                           |
| 2026-06-29 → 07-28 | **Live and valid.** CI secret scanning runs on every commit and does not detect it                                                  |
| 2026-07-28         | Discovered during due-diligence review; confirmed working against prod; written into an untracked audit report                      |
| 2026-07-29         | Containment: scope enumeration → rotation (5/5) → verification (old dead, new live) → redaction → preventive controls → this report |

---

## 11. Lessons

1. **A hardcoded default is a committed secret.** `os.environ.get("X", "literal")` reads as defensive
   programming and is the exact opposite. This is now a gitleaks rule, not a convention.
2. **A green secret-scanning job is not evidence of no secrets.** `--only-verified` silently scoped the
   control to provider-issued credentials. **Every security control should be tested against the threat it
   claims to cover** — a deliberately-planted fake secret in CI would have exposed this gap on day one.
3. **Runbooks leak as readily as code.** Half this incident was a markdown file.
4. **Rotate first, rewrite history never-or-later.** Rotation neutralizes; history rewriting only tidies.
   Treating a rewrite as containment would have delayed the fix that actually mattered.
5. **Synthetic accounts in the production project are still production credentials.** They were the
   difference between Medium and Critical, and that margin depended on RLS correctness — which
   `SECURITY_AUDIT.md` HIGH-1 shows is weaker than assumed.

---

## 12. Owner Action Checklist

- [ ] **R-1** Revoke pre-existing sessions for the 5 accounts (dashboard or SQL), then re-verify
- [ ] **R-3** Review Supabase auth logs 2026-06-29 → 07-29 for unexpected sign-ins _(highest value — the
      only way to know whether the credential was actually used)_
- [ ] **R-5** Install `gitleaks` locally; confirm the pre-commit hook blocks a test commit
- [ ] **R-6** Eyeball `apps/web/env-values/prod.env.example` (2 minutes)
- [ ] **R-2** Decide: accept history residual _(recommended)_ or approve the §6 coordinated rewrite
- [ ] **R-7** Update `verify_synthetic_accounts.py` for per-account secrets
- [ ] Retrieve the new credentials from the session scratchpad and move them to a password manager —
      **the scratchpad is temporary and will not survive**
