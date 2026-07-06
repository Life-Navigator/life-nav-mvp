# Governed Prompt Enforcement Report

Sprint O.0.1 Phase 5 deliverable.

## Problem

Audit A finding §3:

> No CI check enforces buildGovernedPrompt usage for new LLM-driven
> routes. A future route author could import a BYOM provider directly
> and ship a chat handler that concatenates retrieved content into a
> system prompt without going through the builder.

## What shipped

A two-layer enforcement system:

### Layer 1 — `scripts/validation/check_governed_prompt_enforcement.sh`

Bash check that scans `apps/web/src/app/api` and `apps/web/src/lib`
for IMPORT lines matching any of:

```
GeminiProvider
OpenAIProvider
AnthropicProvider
AzureOpenAIProvider
instantiateProvider
from 'openai'
from '@google/generative-ai'
from '@anthropic-ai/sdk'
from 'openai/azure'
```

For each match, the file is allowed if:

- the same line carries a `// GOVERNED_PROMPT_EXEMPT: <reason>` marker, OR
- the file imports `buildGovernedPrompt` or `wrapAsUntrustedEvidence`, OR
- the file is one of the small allowlist (the provider class
  definitions themselves, the governed-prompt builder, test files).

Any other match prints a VIOLATION line and increments the failure
count. Exit 0 on clean, exit 1 on any violation.

### Layer 2 — `apps/web/src/__tests__/governed-prompt-enforcement.spec.ts`

A jest spec that `execFileSync`s the bash script and asserts the exit
code is 0. This means the same enforcement that runs in CI also runs
in `npx jest`, so a developer's local test run will fail BEFORE the
PR opens.

## Current state of the codebase

After Sprint O.0.1's exemption sweep:

```text
$ bash scripts/validation/check_governed_prompt_enforcement.sh
governed-prompt enforcement: OK
```

The three legitimate exemptions:

| File                                      | Exemption reason                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `lib/ingestion/extractors/vision-prod.ts` | media extractor — hardcoded extraction prompt over raw bytes; no retrieved-content mixing |
| `lib/ingestion/extractors/speech-prod.ts` | media extractor — transcription over raw audio bytes; no retrieved-content mixing         |
| `lib/ingestion/extractors/video-prod.ts`  | media extractor — hardcoded extraction prompt over raw bytes; no retrieved-content mixing |

These three are the ONLY production files that import a BYOM provider
adapter. They process raw media bytes with a hardcoded extraction
prompt and never include retrieved knowledge or user input — the
governed-prompt path does not apply. The exemption marker carries the
justification inline so a reviewer can see at a glance why it's safe.

## Adding a new LLM-driven route — the workflow

A future engineer adding a chat handler against a BYOM provider:

```ts
// my-route/route.ts
import { GeminiProvider } from '@/lib/models/gemini'; // ← BYOM import
// CI fails here: no buildGovernedPrompt in this file.

// Either fix:
import { buildGovernedPrompt } from '@/lib/security/injection/governed-prompt';
// ... and use it to assemble the messages ...

// OR add the exemption explicitly:
import { GeminiProvider } from '@/lib/models/gemini'; // GOVERNED_PROMPT_EXEMPT: standalone health-check ping, no retrieved content
```

PR review checks that any new `GOVERNED_PROMPT_EXEMPT` justification
is accurate.

## What this prevents

Three concrete attack patterns that the architecture prevents:

1. **System prompt injection via retrieved doc.** Without
   `buildGovernedPrompt`, a future developer could write:

   ```ts
   const messages = [
     { role: 'system', content: SYSTEM + retrievedDoc.text + USER_RULES },
     { role: 'user', content: userInput },
   ];
   ```

   The check forces them to go through `buildGovernedPrompt` which
   wraps `retrievedDoc.text` as untrusted evidence with the
   instruction-hierarchy preamble.

2. **Direct exfiltration via tool-augmented chat.** A new LLM route
   that wires tool-use without going through `authorizeToolCall`
   would still be flagged by the import check, prompting review.

3. **Skipped injection scan.** `buildGovernedPrompt` scans every
   passage and the user input. A bypass path that hand-rolled the
   messages array would miss this. The lint forces the call site
   to take the scanned path.

## Test count delta

- +1 test for the enforcement spec.
- 0 production callers of `buildGovernedPrompt` today (no LLM-driven
  routes ship yet); the structural test still validates the
  enforcement net.

## What the bash check does NOT catch

Listed transparently:

- **Indirect provider use via a helper module.** If a helper at
  `lib/foo/llm-helper.ts` imports `GeminiProvider` without the
  exemption marker, the check flags it. If the helper instead
  re-exports a generic `callProvider()` and a route uses that, the
  check only sees the helper. Defense: helpers that take untrusted
  content + system prompts MUST use `buildGovernedPrompt`. Code
  review enforces this — the lint is a backstop, not a substitute.
- **Provider use via `eval` / dynamic require.** Not covered. Not
  expected; would trigger a much louder code-review red flag.
