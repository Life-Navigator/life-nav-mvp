# FINANCE_DARK_MODE_FIX_REPORT.md

**Issue:** "Projected retirement assets cannot be seen because it's white on white." Diagnosed live (Playwright, dark mode) as a broader bug: the **Retirement page was built for light mode only** — its cards (`bg-white`, `bg-amber-50`) and text (`text-gray-900/800/...`) had **no `dark:` variants**, so in dark mode they rendered as light boxes with washed-out/invisible text on the dark background. (The Transactions page, by contrast, already had dark styling and rendered fine.)

## Root cause

No `dark:` Tailwind variants on the Retirement page (`finance/retirement/page.tsx`) or the `FinancialResolverPanel` (which renders "Projected retirement assets"). In dark mode the page background goes dark but the cards/text stayed light → white-on-white.

## Fix

Added `dark:` variants systematically (guarded regex; no double-adds, no `/`-suffixed-class breakage):

- `bg-white → dark:bg-gray-800`, `bg-gray-50 → dark:bg-gray-900/40`, `bg-{amber,blue,green,purple,yellow,indigo,red,rose}-50 → dark:bg-*-950/30`
- `border-gray-{100,200} → dark:border-gray-700`, `border-amber-200 → dark:border-amber-800`
- `text-gray-{900,800} → dark:text-gray-100`, `text-gray-{700,600} → dark:text-gray-300`, `text-gray-500 → dark:text-gray-400`, `text-gray-400 → dark:text-gray-500`
- **236** variants added to the Retirement page, **42** to `FinancialResolverPanel`.
- Gradient cards (`bg-*-600 text-white`) and colored buttons were left unchanged (already correct in dark mode).

Files: `apps/web/src/app/dashboard/finance/retirement/page.tsx`, `apps/web/src/components/finance/FinancialResolverPanel.tsx`. Commit `f02e394`.

## Verification (Playwright, dark mode, real onboarded user)

- **Before:** light/white cards on dark bg; "Projected retirement assets" + balance cards washed out (`/tmp/ret.png`).
- **After:** dark cards (slate/gray) with readable light text; "Projected retirement assets" panel legible; metric cards (Total Portfolio, Monthly Contributions, etc.) readable (`/tmp/ret2.png`).
- eslint: 0 errors. tsc: 0 errors in the changed files. Deployed to prod (`main` = `f02e394`, Vercel READY).

## Status: FIXED + DEPLOYED + VISUALLY VERIFIED

</content>
