# VERTEX_ANTHROPIC_QUOTA_PLAN.md — Phase 6

## Observed

Under **light concurrency** (a handful of simultaneous requests) the Vertex `global` Anthropic endpoint returned **HTTP 429 Too Many Requests** for `claude-opus-4-1`/`opus-4-8`. Sequential calls succeeded. So the project's default Anthropic online-prediction quota is low.

## Current vs needed

- **Current:** default per-project Anthropic quota on Vertex (low; not raised). Exact value: check **GCP Console → IAM & Admin → Quotas → filter "Anthropic" / "aiplatform.googleapis.com online_prediction_requests_per_base_model"** for the project + `global`.
- **Needed (pilot):** size to peak concurrent advisor turns routed to Claude. With the hybrid (finance/health high-stakes only) at, say, ~20 pilot users, peak concurrency is small (single-digit), but the default quota already 429'd at that level — so request a margin: **≥ 60 requests/min (RPM) for the Opus model on `global`**, plus token-per-minute headroom.

## Support request wording (paste into the GCP quota increase form)

> Project: gen-lang-client-0849161409. Please increase the Vertex AI online prediction quota for Anthropic publisher models (claude-opus-4-8, claude-opus-4-1) on the `global` endpoint to at least 60 requests/min and the corresponding tokens/min. We are launching a pilot that routes high-stakes finance/health advisor turns to Claude; we currently hit 429s at low concurrency on the default quota.

## Fallback behavior until quota increases (already implemented)

- The hybrid keeps **Gemini 2.5 Pro as same-tier fallback**: a Claude 429 → loud `advisor_model_fallback` log → Gemini answers the turn. **No user-facing failure, no silent downgrade.**
- Until quota lands: either keep `ENABLE_VERTEX_CLAUDE=false` (all Gemini), or enable it knowing some high-stakes turns will fall back to Gemini under load (still correct, just not the Claude lift).
- Add monitoring: alert on `advisor_model_fallback reason~=429` rate; if high, the quota is the bottleneck.

## Recommendation

Request the increase **before** enabling the hybrid for the pilot. Enabling without it = intermittent Gemini fallback on the exact high-stakes turns Claude was meant to improve.
