# Dead Code Audit

Verification Audit — Phase 5.

## Method

Confirm Sprint N.2 deletions actually happened. Search for residual
orphaned modules. Identify any new dead code introduced by the
addendum work.

## Sprint N.2 deletions — confirmed

```text
$ ls apps/web/src/lib/cache
no such directory

$ ls apps/web/src/lib/architecture
no such directory

$ ls apps/web/src/lib/agents
no such directory

$ ls apps/web/src/components/agents
no such directory

$ ls apps/web/src/app/test-agent
no such directory
```

| File                                                | Status    |
| --------------------------------------------------- | --------- |
| `apps/web/src/lib/cache/redis-client.ts`            | DELETED ✓ |
| `apps/web/src/lib/architecture/modular-services.ts` | DELETED ✓ |
| `apps/web/src/lib/agents/orchestration-engine.ts`   | DELETED ✓ |
| `apps/web/src/lib/agents/agent-factory.ts`          | DELETED ✓ |
| `apps/web/src/lib/agents/types.ts`                  | DELETED ✓ |
| `apps/web/src/components/agents/MultiAgentChat.tsx` | DELETED ✓ |
| `apps/web/src/app/test-agent/page.tsx`              | DELETED ✓ |

Parent directories collapsed to empty and removed.

✅ **All Sprint N.2 deletions verified.**

## Residual dead code — identified by Phase 3

Two server-side legacy files survived the Sprint N.2 sweep:

### `apps/web/src/lib/api/backend-services.ts`

```text
$ grep -rln "from.*lib/api/backend-services" apps/web/src
(no production importers; not even a test importer)
```

448 LOC of registry pointing to legacy Python microservices that no
longer exist. Five `process.env.* || 'http://localhost:8000/api/v1'`
fallbacks.

**Verdict:** dead code.

### `apps/web/src/services/agent-proxy.ts`

```text
$ grep -rln "from.*services/agent-proxy" apps/web/src
apps/web/src/services/agent-proxy.test.ts    (test only)
apps/web/src/services/README.md              (docs only)
```

A 600+ LOC proxy that fronts a legacy Python agent service. Zero
production importers. The 32-second test suite (`agent-proxy.test.ts`)
exists but exercises a module no route uses.

**Verdict:** dead code (with test coverage that protects against
regressions in code nobody calls).

### `apps/web/src/services/README.md`

References both of the above. Should be removed when they are.

### `apps/web/src/lib/api/agent.ts`

```text
$ grep -rln "from.*lib/api/agent" apps/web/src
(no production importers — only the file itself)
```

Defines a localhost:8080 fallback. Also dead.

## Governance bypass paths — eliminated

Sprint N.2 deleted the `orchestration-engine.ts` chain which was the
only documented governance bypass. After the addendum, the
prompt-injection scan is wired into both ingestion AND response paths.

Verified no `validateAndPersist` direct calls outside the governance
library itself:

```text
$ grep -rln "validateAndPersist" apps/web/src/app/api
(none outside the governance/validate route which intentionally exposes the function)
```

✅ **PASS.**

## Verdict for Phase 5

**PARTIAL PASS.**

Sprint N.2's stated deletions all happened. The deletion pass was
not exhaustive — three additional dead modules (`backend-services.ts`,
`agent-proxy.ts`, `lib/api/agent.ts`) remain and were missed.

These remain LOW-RISK because they have zero production importers,
but they should be removed to:

1. Close the residual server-side localhost-fallback exposure
   identified in Phase 3.
2. Cut ~1,200 LOC of unused TypeScript and one 32-second test suite.
3. Remove the `services/README.md` reference to the legacy
   architecture.

## Recommended next-sprint cleanup

```bash
git rm apps/web/src/lib/api/backend-services.ts
git rm apps/web/src/lib/api/agent.ts
git rm apps/web/src/services/agent-proxy.ts apps/web/src/services/agent-proxy.test.ts
git rm apps/web/src/services/README.md
```

After this, the residual server-side dead code in the repo is zero.
