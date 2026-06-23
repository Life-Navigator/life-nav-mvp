# ARCANA_CONVERSATION_VALIDATION.md — Phase 7

Live prod, real onboarded user, `/v1/life/advisor/chat`. Each checked for conversational form + domain + citations + reasoning.

| Prompt                               | Domain        | Conversational (no headers) | Citations | Reasoning kept | Notes                                              |
| ------------------------------------ | ------------- | --------------------------- | --------- | -------------- | -------------------------------------------------- |
| "Build me a weekly training plan…"   | health        | ✅                          | 25        | ✅             | phased plan + knee/shoulder mods + provider caveat |
| "Can I afford a $400k house?"        | finance       | ✅                          | 25        | ✅             | uses own numbers ($192k comp, $500 liquid)         |
| "I just got promoted."               | career        | ✅                          | 25        | ✅             | career-aligned, cross-domain aware                 |
| "What happens if I die tomorrow?"    | family/estate | ✅                          | 25        | ✅             | survivor/protection framing                        |
| "Help me prepare for having a baby." | family        | ✅                          | 25        | ✅             | financial + logistical, existing dependents        |

## Per-prompt verification

- correct domain: ✅ (routing fix holds)
- conversational answer: ✅ (no six-section template, all 5)
- citations/evidence preserved: ✅ (25 each, behind structured fields)
- no irrelevant finance derailment: ✅ (health stayed health)
- one useful next step: ✅ (single follow-up question per turn)
