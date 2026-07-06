# Dependabot / npm-audit Triage Report

Sprint M closeout Phase 3.

## 1. Methodology

GitHub Dependabot reported **20 vulnerabilities** on the default branch (8 high / 9 moderate / 3 low) at the close of Sprint M. The local `pnpm audit` run resolves the same set of CVEs at deeper granularity — every distinct CVE counts even when several share a single package. Both views were triaged together.

```
Before remediation:
  critical : 2
  high     : 44
  moderate : 43
  low      : 7
```

The high-count surface is dominated by transitive duplicates: many `next` advisories on different code paths, many `axios` prototype-pollution gadgets, all of which fold into a single upstream upgrade per package.

## 2. Remediation strategy

Two mechanisms:

1. **Direct dependency bump** for `next` + `jspdf` in `apps/web/package.json`.
2. **Root-level pnpm overrides** in `package.json` to force-resolve every transitive package whose patched version is published.

```json
"pnpm": {
  "overrides": {
    "tinyexec": "1.0.4",
    "axios": ">=1.16.0",
    "handlebars": ">=4.7.9",
    "@xmldom/xmldom": ">=0.8.13",
    "node-forge": ">=1.4.0",
    "tar": ">=7.5.11",
    "picomatch": ">=4.0.4",
    "fast-xml-parser": ">=5.5.6",
    "fast-xml-builder": ">=1.1.7",
    "flatted": ">=3.4.2",
    "@babel/plugin-transform-modules-systemjs": ">=7.29.4"
  }
}
```

Apps-web direct deps:

- `next` 16.1.1 → **16.2.6** (patches: middleware bypass × 4, DoS × 3, SSRF × 1)
- `jspdf` ^4.2.0 → **^4.2.1** (patches: PDF Object Injection + HTML Injection)

After `pnpm install --no-frozen-lockfile`:

```
critical : 0   (was 2)
high     : 1   (was 44)
moderate : 14
low      : 2
```

## 3. Per-package status

### Resolved (critical + high)

| Package                                    | Was           | Now     | Severity at fix      | Notes                                                                                                                                         |
| ------------------------------------------ | ------------- | ------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `jspdf`                                    | ≤4.2.0        | ≥4.2.1  | **critical → fixed** | HTML Injection in New Window paths (CWE-79); PDF Object Injection via FreeText color (CWE-116)                                                |
| `handlebars`                               | ≥4.0.0 ≤4.7.8 | ≥4.7.9  | **critical → fixed** | AST Type Confusion (CWE-94/843); DoS via Malformed Decorator; CLI Precompiler injection (4 advisories)                                        |
| `next`                                     | 16.1.1        | 16.2.6  | **high → fixed**     | App Router middleware/proxy bypass × 4 (CWE-288/863); DoS × 3 (CWE-770); SSRF via WebSocket (CWE-918); HTTP deserialization DoS (CWE-400/502) |
| `axios`                                    | <1.16.0       | ≥1.16.0 | **high → fixed**     | Prototype pollution × 4 (CWE-1321); SSRF via proxy bypass × 2 (CWE-918); header injection (CWE-113); MITM via prototype pollution gadget      |
| `@xmldom/xmldom`                           | <0.8.13       | ≥0.8.13 | **high → fixed**     | XML injection × 4 (CWE-91); DoS via uncontrolled recursion (CWE-674)                                                                          |
| `tar`                                      | <7.5.11       | ≥7.5.11 | **high → fixed**     | Path traversal × 5 (CWE-22); symlink + hardlink attacks (CWE-59); Unicode race (CWE-176/367)                                                  |
| `node-forge`                               | <1.4.0        | ≥1.4.0  | **high → fixed**     | RSA-PKCS forgery (CWE-20/347); Ed25519 missing S>L check (CWE-347); basicConstraints bypass (CWE-295); DoS via infinite loop (CWE-835)        |
| `picomatch`                                | <4.0.4        | ≥4.0.4  | **high → fixed**     | ReDoS via extglob quantifiers (CWE-1333) — 3 version bands                                                                                    |
| `fast-xml-parser`                          | <5.5.6        | ≥5.5.6  | **high → fixed**     | Numeric entity expansion bypass (CWE-776)                                                                                                     |
| `fast-xml-builder`                         | <1.1.7        | ≥1.1.7  | **high → fixed**     | XML injection via attribute quoting bypass (CWE-91/611)                                                                                       |
| `flatted`                                  | <3.4.2        | ≥3.4.2  | **high → fixed**     | Prototype pollution in parse() (CWE-1321)                                                                                                     |
| `@babel/plugin-transform-modules-systemjs` | <7.29.4       | ≥7.29.4 | **high → fixed**     | Arbitrary code generation at compile time (CWE-94/843)                                                                                        |

### Unresolved — accepted residual risk (documented)

| Package          | Severity | Status                                                | Mitigation                                                                                                                                                                                                                                                                         |
| ---------------- | -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lodash` 4.17.23 | high     | **patched_versions: ≥4.18.0 — does not exist on npm** | Code-search confirms no use of `_.template` anywhere in `apps/web/src` or `packages/**`. The only path is via `recharts`, which uses lodash for non-template utilities. **Attack vector is not reachable**. We accept the residual risk pending an upstream lodash 4.18.0 release. |

### Moderate (14) — scheduled

All moderate findings are transitive build-time tooling (esbuild, postcss plugins, dev-only loaders). Per the Sprint M policy "Moderate — Fix where compatible. Document exceptions.", these are scheduled for the next routine `pnpm update` cycle and do not gate beta launch.

### Low (2) — scheduled

Both low findings are in dev-only tooling. Scheduled for the next update cycle.

## 4. Verification

```bash
pnpm audit --json | python3 -c "..."
```

Output:

```
After overrides:
  critical : 0
  high     : 1   (documented: lodash 4.18.0 unavailable, attack vector unreachable)
  moderate : 14
  low      : 2
```

## 5. Sprint M criteria — met

| Criterion                                                                            | Status |
| ------------------------------------------------------------------------------------ | ------ |
| 0 unresolved critical                                                                | ✅     |
| 0 unresolved high (excluding patched-version-unavailable with documented mitigation) | ✅     |
| Moderate documented + scheduled                                                      | ✅     |
| Low documented + scheduled                                                           | ✅     |

## 6. Next maintenance cycle

After the next routine update:

- Watch for `lodash` 4.18.0 publication; bump to override immediately on release.
- Re-run `pnpm audit --json` weekly during beta; alert if `high` returns to nonzero (excluding lodash).
- Add `pnpm audit --audit-level=high` to CI as a gate.
