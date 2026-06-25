# UI_SMOKE_SCREENSHOT_INDEX.md

Captured 2026-06-25, authenticated prod session. Files in `/tmp/ui-smoke/shots/` (session-local; copy out to archive).

| File                          | Surface                        | Notes                                                                |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| 00_login_form.png             | /auth/login                    | password form                                                        |
| 01_dashboard.png              | /dashboard                     | honest empty states; scoped discovery CTAs; "Active Persona: None"   |
| 02_finance_redirect.png       | /dashboard/finance             | landed on /dashboard/finance/overview (redirect ✅)                  |
| 03_finance_overview.png       | /dashboard/finance/overview    | no-persona honest empty ($0, "No accounts connected")                |
| 03b_finance_overview_DATA.png | overview w/ persona            | Net Worth −$17,640; **red negative liabilities**; spending+cash flow |
| 03c_finance_accounts_DATA.png | /dashboard/finance/accounts    | accounts list w/ persona data                                        |
| 04_career.png … 07_family.png | Career/Education/Health/Family | load; discovery/empty states                                         |
| 08_life_graph.png             | /life-graph/explainable        | loads                                                                |
| 09_recommendations.png        | /dashboard/recommendations     | loads                                                                |
| 10_reports.png                | /dashboard/reports             | loads                                                                |
| 11_documents.png              | /dashboard/documents           | loads                                                                |
| 12_my_life.png                | /dashboard/my-life             | loads                                                                |
| 13_settings.png               | /dashboard/settings            | loads                                                                |
| 14_profile.png                | /dashboard/profile             | (pre-fix capture showed the crash; fixed in d1af04a)                 |
| 15_finance_legacy_estate.png  | /dashboard/finance/legacy      | estate planning, untouched                                           |
| 16_advisor_chat.png           | /dashboard/advisor             | chat UI                                                              |
| 17_advisor_workout.png        | advisor turn                   | ⚠️ discovery opener instead of direct plan                           |
| 18_advisor_affordability.png  | advisor turn                   | (same conversational-mode flag)                                      |
