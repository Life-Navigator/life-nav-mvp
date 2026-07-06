# ARCANA_RECOMMENDATION_CARDS.md — Phase 3 (honest scope)

## Status: NOT built this turn — and here's why (no fabrication)

The advisor **chat turn** does not return a structured recommendation-card payload (recommendation + impact + confidence + urgency + Accept/Later). In chat, the recommendation is **woven into the conversational message** (by design — Arcana speaks it), and the reasoning behind it is in the "Why?" drawer.

The structured **recommendation cards already exist** on the dedicated surface: `/dashboard/recommendations` (the roadmap — NOW/NEXT/LATER cards with Why/evidence/impact/confidence/Accept/Start/Complete). That is the right home for them.

## Recommendation (small, future)

To put an inline rec card in chat, the advisor turn would need to attach the top matching `recommendations` row (id, title, impact, confidence, urgency) — a backend addition to the advisor response, then a `RecommendationCard` component with Review/Accept/Later that calls the existing `/api/recommendations` PUT. This is the natural bridge to the **Advisor Action Loop** (approval-gated). Not built here to avoid inventing a card payload that doesn't yet exist.
