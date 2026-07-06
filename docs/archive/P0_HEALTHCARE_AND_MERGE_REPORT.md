# P0 — Healthcare Card Fix + Merge to Production — 2026-06-10

## Healthcare card root cause

`/api/dashboard/summary` returned `health: { nextAppointment:null, wellnessScore:null,
medicationsDue:0, hasData:false }` as a **hardcoded literal** — it never read any health source, so the
Healthcare Overview card could _never_ show data regardless of what existed. **Fix:** the route now reads
real signals from `health_meta` (medications count, next upcoming appointment, latest daily_wellbeing
score), each query isolated + RLS-safe, and computes `hasData` from them (folded into `hasAnyData`).

Important nuance: `public.is_health_enabled()` is defined `SELECT false` — the health feature is
**globally locked for beta by design**, so `health_meta` RLS denies all user-context reads. The card
therefore still renders an **honest empty state** for every beta user — but it is now **computed from the
canonical health source, not a hardcoded false**, and will auto-populate the moment the flag is flipped.

## Files changed (this step)

- `apps/web/src/app/api/dashboard/summary/route.ts` — real `health_meta` read (medications/appointments/
  daily_wellbeing) replacing hardcoded `health.hasData:false`; folded into `hasAnyData`.
  (Prior incident commits: `page.tsx` top-block removal `4918486`; finance-card loading/error states
  `f1fd7d1`; `/api/plaid/{accounts,transactions}` + AccountCard defensive + AccountsSummary classify-by-type

* FinanceSidebar canonical + beta language across `083b4b2…1502b4a`.)

## Final preview URL

`https://life-nav-mvp-dm94pg0mi-riffe007s-projects.vercel.app` (branch @ `81727c0`, pre-merge).

## Browser validation table (latest preview, headless Chromium, logged in)

| #   | Check                                            | married_family                                        | high_income_executive     |
| --- | ------------------------------------------------ | ----------------------------------------------------- | ------------------------- |
| 1   | Dashboard top brief gone                         | ✅                                                    | ✅                        |
| 2   | Finance card real canonical data                 | ✅ −$376,940                                          | ✅ $290,080               |
| 3   | Sidebar connected-account state (finance pages)  | ✅ "5 accounts"                                       | ✅                        |
| 4   | Healthcare card not hardcoded false              | ✅ reads health_meta (globally locked → honest empty) | ✅                        |
| 5   | Accounts page opens                              | ✅                                                    | ✅                        |
| 6   | Investments correct                              | ✅ honest no-holdings                                 | ✅ $920,000 account-level |
| 7   | Retirement renders                               | ✅                                                    | ✅                        |
| 8   | No "No financial data yet" when canonical exists | ✅                                                    | ✅                        |
| 9   | No "Something went wrong"                        | ✅                                                    | ✅                        |
| 10  | No "Unable to load"                              | ✅                                                    | ✅                        |

## Screenshots saved

- Preview: `reports/browser-validation/latest/final-married_family/*`, `final-high_income_executive/*`
- Production: `reports/browser-validation/latest/PROD/*` (dashboard, finance, accounts, investments, retirement, overview)

## Merge commit

Fast-forward merge of `fix/platform-trust-stabilization` → `main`: **`536f9dc..afa9f2e`** (main HEAD = `afa9f2e`).

## Production URL

`https://app.lifenavigator.tech` — Vercel production deploy of `afa9f2e` is **READY** (was `536f9dc`).

## Production smoke result (app.lifenavigator.tech, logged in, both personas)

- Unauthenticated `/dashboard` → 302 `/auth?mode=signin` (middleware gate OK).
- All 6 pages (dashboard, finance, accounts, investments, retirement, overview) → **200, no crash**.
- married_family: `topBriefGone=true noFakeEmpty=true crash=false` · Finance card Net Worth **−$376,940**.
- high_income_executive: `topBriefGone=true noFakeEmpty=true crash=false` · Finance card Net Worth **$290,080**.

## Remaining P1 / P2 items

- **P1 (health feature)**: when health ships, flip `is_health_enabled()` → the card auto-populates; consider
  a "Health tracking coming soon" empty-state label instead of "Add your health information" while locked.
- **P2**: Education `studyStreak` hardcoded `0`; Alerts `unreadCount` not returned (badge never shows);
  Career card still via legacy `/api/dashboard/summary` (works, but not the canonical career VM);
  MissionControl "Welcome / Preview with sample data" sits above the domain cards; Quick Actions order;
  "Go to Healthcare" nav label; non-finance "Connect Account" sweep (career/education/integrations/budget).
- **Security**: revoke the Vercel + Supabase tokens pasted in chat.
