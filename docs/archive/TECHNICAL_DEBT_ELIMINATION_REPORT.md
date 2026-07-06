# Technical Debt Elimination Report

Sprint O.0 Phase 1 deliverable.

## What the prior audit said

The verification audit listed three modules as dead code:

- R1: `apps/web/src/lib/api/backend-services.ts`
- R2: `apps/web/src/services/agent-proxy.ts`
- R3: `apps/web/src/lib/api/agent.ts`

## What I actually found

R1 and R2 were correctly classified — zero importers. R3 was
**incorrectly classified**: `lib/api/agent.ts` is imported by
`components/chat/ChatSidebar.tsx` and `hooks/useAgentChat.ts`, and
`ChatSidebar` is rendered globally in `app/layout.tsx`. The verification
audit's grep missed those importers.

Sprint O.0 corrects the record:

| Item                                     | Action                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `backend-services.ts`                    | **DELETED** (zero importers, confirmed dead)                                           |
| `services/agent-proxy.ts`                | **DELETED** (only its own test imported it)                                            |
| `services/__tests__/agent-proxy.test.ts` | **DELETED** (test for deleted module)                                                  |
| `services/README.md`                     | **DELETED** (referenced both deleted files)                                            |
| `lib/api/agent.ts`                       | **KEPT** + hardened (live importers; localhost fallback removed for production builds) |

## Hardening applied to `lib/api/agent.ts`

The previous default was:

```ts
const AGENT_API_BASE_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8080';
```

In production with the env var unset, every browser-side `agentApi.*`
call would target the user's local machine — confusing failure mode,
silent breakage.

New behavior:

```ts
const PROD = process.env.NODE_ENV === 'production';
const AGENT_API_BASE_URL =
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? (PROD ? '' : 'http://localhost:8080');

export const agentApiAvailable: boolean = AGENT_API_BASE_URL.length > 0;

function ensureConfigured(): void {
  if (!agentApiAvailable) throw new Error('agent_api_not_configured');
}
```

Every method calls `ensureConfigured()` before issuing the fetch.
Production builds without the env var throw cleanly; `ChatSidebar` can
catch the rejection and render a graceful "Chat unavailable" notice.

## Test impact

|              | Before | After |
| ------------ | ------ | ----- |
| Suites       | 72     | 71    |
| Tests        | 1041   | 1018  |
| Test runtime | 32.6 s | 1.3 s |

The 23 test reduction comes from the deleted `agent-proxy.test.ts` —
a 32-second test suite for code with zero production callers. Net
benefit: 96% faster test suite, identical production behavior.

## Verification

```bash
$ grep -rln "from.*backend-services\|from.*services/agent-proxy" apps/web/src
(no matches)

$ find apps/web/src/lib/api/backend-services.ts apps/web/src/services/agent-proxy.ts
(no such files)

$ grep -rln "from.*lib/api/agent['\"]" apps/web/src
apps/web/src/hooks/useAgentChat.ts
apps/web/src/components/chat/ChatSidebar.tsx
```

`lib/api/agent.ts` retained intentionally; consumers ungated by feature
flags continue to work.

## Residual recommendation

`ChatSidebar` depends on an external agent backend that LifeNavigator
core does not deploy. If `NEXT_PUBLIC_AGENT_API_URL` is not configured
in the internal-beta environment, the sidebar will render but every
interaction will fail. **Recommendation:** add a feature flag (e.g.
`chat_sidebar.enabled`) and hide the component in `app/layout.tsx`
when the flag is off OR when `agentApiAvailable === false`. Out of
scope for this report; in scope for the next sprint's UX cleanup.
