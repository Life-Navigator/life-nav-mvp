# Model Selection Policy

Sprint O.0.2 deliverable.

## Goal

No expensive model is used by default. Every feature declares its
tier; the policy resolves the tier to a concrete (provider, model)
pair, defaulting to the cheapest option in the tier.

## Tier definitions

### Tier 1 — Gemini Flash

For:

- Simple extraction
- Simple classification
- Tagging
- Speech transcription
- Constitutional review (we want it cheap; the engine itself is
  deterministic so the model side is a thin compliance helper)

Default model: `gemini-2.5-flash`
($0.075/Mtok input, $0.30/Mtok output)

Why: tier-1 work is structured + repetitive. The premium of a larger
model isn't justified.

### Tier 2 — Gemini Pro / GPT-4o-mini

For:

- Recommendation generation (optimizer / arcana / provider)
- Decision intelligence
- Simulation narratives
- User-facing chat

Default model: `gemini-2.5-pro`
($1.25/Mtok input, $5/Mtok output)

Why: tier-2 work is reasoning + recommendations that affect user
outcomes. A modestly larger model helps with quality. Still 17× cheaper
than the most expensive tier.

### Tier 3 — Operator-approved only

For:

- Heavy multimodal reasoning (video understanding)
- Future LLM-driven features that demand premium quality

Default model: `gemini-2.5-pro` BUT `requires_operator_approval = true`.

Operators enable specific features in the tier 3 set via the
`operator_approved_features` set. Until enabled, the call refuses
to issue.

## Feature → tier mapping

```ts
export const FEATURE_TIER: Record<FeatureKey, ModelTier> = {
  'extraction.classification': 'tier_1',
  'extraction.vision_ocr': 'tier_1',
  tagging: 'tier_1',
  'extraction.speech_transcript': 'tier_1',
  'extraction.video': 'tier_3', // ← approval required
  'recommendation.optimizer': 'tier_2',
  'recommendation.arcana': 'tier_2',
  'recommendation.provider': 'tier_2',
  decision_intelligence: 'tier_2',
  'simulation.narrative': 'tier_2',
  'governance.constitutional_review': 'tier_1',
  'chat.user': 'tier_2',
};
```

## Tenant overrides

A tenant can pin a specific (provider, model) for a feature via
`models.tenant_model_overrides` (Sprint P). The selection policy
respects this override but **does not change the tier classification**
— so the tier 1 cost contract is preserved for budgeting even if a
specific tenant ships `chat.user` on Claude 3.5 Sonnet.

```ts
const r = selectModel({
  feature: 'chat.user',
  tenant_override: { provider: 'anthropic', model: 'claude-3-5-haiku' },
});
// r.tier remains 'tier_2'
// r.provider = 'anthropic'
// r.model = 'claude-3-5-haiku'
```

## Operator approval workflow for tier 3

```sql
-- Operator enables video extraction:
UPDATE ops.feature_flags
   SET enabled = TRUE
 WHERE flag_key = 'economic.operator_approved.extraction.video';
```

The call site:

```ts
const approvedFlags = await readApprovedFlags(supabase);
const m = selectModel({
  feature: 'extraction.video',
  operator_approved_features: approvedFlags,
});
if (m.requires_operator_approval) {
  return safeApiError({
    code: 'forbidden',
    publicMessage: 'This feature requires operator approval.',
  });
}
```

## Cost contract

Anchored in `lib/economic/cost-estimator.ts` rate tables. Sprint O.0.2
hardcoded Q1 2026 published rates. Updating a rate is a 1-line code
change with a self-contained test update.

For the internal beta defaults, here's what each tier costs per call
under a typical workload (1k input tokens + 256 output tokens):

| Tier                                                | Provider/Model    | Cost per typical call |
| --------------------------------------------------- | ----------------- | --------------------- |
| Tier 1                                              | gemini-2.5-flash  | $0.000152             |
| Tier 2                                              | gemini-2.5-pro    | $0.00253              |
| Tier 3 (gemini-2.5-pro default)                     | gemini-2.5-pro    | $0.00253              |
| **For comparison:** claude-3-5-sonnet (NOT default) | claude-3-5-sonnet | $0.0068               |

Tier 1 is 17× cheaper than Tier 2. Choosing the wrong tier for a
volume feature is the single biggest economic risk; the policy
makes the safe choice the default.

## Adding a new feature

Two-step:

1. Add the `FeatureKey` literal to the TypeScript union in
   `lib/economic/model-selection.ts`.
2. Add the literal → tier mapping in `FEATURE_TIER`.

The `selectModel()` call resolves the default automatically. To
override the model for a tier (e.g. switching tier 2 default from
Gemini Pro to GPT-4o-mini), change `TIER_DEFAULTS` in one place +
update the test assertion in `model-selection.spec.ts`.

## What this prevents

- **Accidental Sonnet on chat.** chat.user is tier 2 → defaults to
  Gemini Pro. Choosing Sonnet requires either a per-tenant override
  (audited row in `models.tenant_model_overrides`) or a code change.
- **Tier 3 by default.** `extraction.video` will refuse to run until
  the operator approves it. The user-facing error is generic; the
  approval row is documented in `ops.feature_flags`.
- **Vendor lock-in.** The policy is provider-agnostic. Switching
  tier 2 default to GPT-4o-mini is one line; switching the upload
  vision extractor to Claude Haiku is one line. The rate table tells
  the operator what the swap will cost.

## Test coverage

13 tests in `model-selection.spec.ts`:

- Every tier default resolves to the expected (provider, model).
- Tenant overrides change provider/model but not tier.
- Tier 3 requires operator approval; the approval flag clears the
  requirement.
- Every declared `FeatureKey` maps to a valid tier (defensive — caught
  by exhaustive enum check).
