#!/usr/bin/env bash
# ============================================================================
# check_governed_prompt_enforcement.sh — Sprint O.0.1 Phase 5
#
# Fails CI if any production API route imports a BYOM provider class or
# external LLM SDK without ALSO importing `buildGovernedPrompt`. This
# prevents the "future developer concatenates retrieved content with a
# system prompt" failure mode.
#
# Routes may carry an explicit exemption marker comment ON THE SAME LINE
# AS THE IMPORT:
#
#   import { GeminiProvider } from '@/lib/models/gemini'; // GOVERNED_PROMPT_EXEMPT: media-extractor
#
# The exemption must include a justification after the colon. Audit
# review checks that exemptions are appropriate (media extractors that
# don't mix retrieved content are typical).
#
# Usage:
#   bash scripts/validation/check_governed_prompt_enforcement.sh
#
# Exit codes:
#   0 — all imports are either guarded or explicitly exempt
#   1 — at least one route imports a provider without a guard or exemption
# ============================================================================

set -eu

cd "$(dirname "$0")/../.."
SEARCH_ROOTS=("apps/web/src/app/api" "apps/web/src/lib")

# Patterns that indicate a BYOM provider class or external SDK import.
# A match on any of these requires either buildGovernedPrompt OR
# GOVERNED_PROMPT_EXEMPT on the same line.
declare -a PROVIDER_PATTERNS=(
  "GeminiProvider"
  "OpenAIProvider"
  "AnthropicProvider"
  "AzureOpenAIProvider"
  "instantiateProvider"
  "from\s+['\"]openai['\"]"
  "from\s+['\"]@google/generative-ai['\"]"
  "from\s+['\"]@anthropic-ai/sdk['\"]"
  "from\s+['\"]openai/azure['\"]"
)

FAILED=0
PROVIDER_REGEX=$(printf '%s|' "${PROVIDER_PATTERNS[@]}")
PROVIDER_REGEX=${PROVIDER_REGEX%|}

for root in "${SEARCH_ROOTS[@]}"; do
  while IFS= read -r match; do
    file="${match%%:*}"
    line="${match#*:}"
    line_content="${line#*:}"
    # Only flag IMPORT lines. Same-file references like
    # `const provider = instantiateProvider(...)` are inherited from
    # the import — if the import is exempt the whole file is exempt.
    if ! echo "$line_content" | grep -qE "^[[:space:]]*import\b|^import\b"; then
      continue
    fi
    # Allow if the import line itself has the exemption marker.
    if echo "$line_content" | grep -q "GOVERNED_PROMPT_EXEMPT:"; then
      continue
    fi
    # Allow if the file imports buildGovernedPrompt or wrapAsUntrustedEvidence.
    if grep -qE "buildGovernedPrompt|wrapAsUntrustedEvidence" "$file"; then
      continue
    fi
    # Allow if the file is the governed prompt builder itself or a test.
    case "$file" in
      */injection/governed-prompt.ts|*/injection/index.ts|*/models/factory.ts|*/models/registry.ts|*/models/gemini.ts|*/models/openai.ts|*/models/anthropic.ts|*/models/azure-openai.ts|*/__tests__/*|*.spec.ts|*.test.ts)
        continue
        ;;
    esac
    echo "VIOLATION: $file:$line"
    echo "  Provider/SDK imported without buildGovernedPrompt or GOVERNED_PROMPT_EXEMPT marker."
    echo "  Either:"
    echo "    1. Use buildGovernedPrompt to assemble the outbound prompt, OR"
    echo "    2. Add '// GOVERNED_PROMPT_EXEMPT: <reason>' to the import line."
    FAILED=$((FAILED + 1))
  done < <(grep -rEn "$PROVIDER_REGEX" "$root" 2>/dev/null || true)
done

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "$FAILED governed-prompt enforcement violation(s)."
  exit 1
fi

echo "governed-prompt enforcement: OK"
exit 0
