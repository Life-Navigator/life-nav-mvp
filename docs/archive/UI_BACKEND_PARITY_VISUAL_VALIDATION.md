# UI_BACKEND_PARITY_VISUAL_VALIDATION.md — Phase 7

What's verified now vs what verifies at smoke-test (post-deploy). Honest about the line between compile/data-level proof and pixel-level proof.

## Verified now (compile + live data path)

| Item                                      | Evidence                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Family Estate tab → Family Office pillars | `GET /v1/family/office` **200** for demo user `0a291b09` (`legacy_index 45/orange`, estate `red`); panel compiles (tsc/eslint clean) |
| Health Analysis tab → Health Intelligence | `GET /v1/health/intelligence` **200** (readiness 100, labs cholesterol 210); panel compiles                                          |
| Dashboard `RecentlyLearned` strip         | component renders real facts in jest; **data exists** (58 backfilled `life.facts`)                                                   |
| Life Graph removed from primary nav       | nav array edited; tsc/eslint clean                                                                                                   |
| `life.facts` populated                    | 58 rows, 3 users, provenance resolves (LIFE_FACTS_BACKFILL_VALIDATION)                                                               |

## Pending pixel-level verification (at smoke-test, post-deploy)

| Item                                       | Why pending                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Dashboard strip renders in browser         | needs **core-api deploy** — `GET /v1/life/facts` currently 404 (endpoint in unpushed commit) |
| Advisor cites document-derived facts live  | needs core-api deploy (advisor `life.facts` reader in unpushed commit)                       |
| Logged-in pixel pass of Family/Health tabs | needs web deploy + a session; data path already proven 200                                   |

## The deploy dependency (precise)

- **Web deploy alone** makes live: Family Office tab, Health Intelligence tab, graph nav removal — because their backends (`/v1/family/office`, `/v1/health/intelligence`) are **already deployed**.
- **Core-api deploy** makes live: `/v1/life/facts` (dashboard strip) + advisor citing `life.facts`. The data is already backfilled, so these light up the instant core-api ships the unpushed commits.

## Honest verdict

Parity is **materially improved and verified to the data layer**; the only unverified piece is in-browser pixels, which is a deploy-and-smoke step, not a code question. No fabrication: every surface renders real endpoint data or an honest empty state.
</content>
