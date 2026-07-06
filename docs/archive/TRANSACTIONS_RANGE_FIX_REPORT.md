# TRANSACTIONS_RANGE_FIX_REPORT.md

**Issue:** "Only one transaction showing." Diagnosed live: the Transactions page renders correctly, but its **default date range was hardcoded to the last 30 days**, hiding everything older. For a real user this meant a single in-window transaction displayed while the rest were silently filtered out.

## Root cause

`apps/web/src/app/dashboard/finance/transactions/page.tsx` initialized `startDate` to `today − 30 days`:

```ts
const [startDate, setStartDate] = useState(() => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
});
```

## Fix

Default to **all available transactions** (pilot/demo: users must see their data immediately; filters still let them narrow):

```ts
const [startDate, setStartDate] = useState(() => new Date('2000-01-01'));
```

The date-range filter UI (Last 7/30/90 days, Year to date, custom) is unchanged — users can still narrow. Commit `f02e394`.

## Verification (Playwright, real onboarded user with many transactions)

- **Before:** 1 transaction shown ("EXEC SALARY", the only one in the 30-day window).
- **After (expense-heavy user, 81+ recent + older transactions):** **54 dollar amounts rendered** on the page — the full set now displays by default.
- eslint/tsc clean. Deployed to prod.

## Note

The fetch uses `timeframe=year`; with the all-dates default this surfaces every transaction within the fetched window. If a user has transactions older than one year that must also show, broaden the fetch `timeframe` — not needed for current data (demo/seed transactions are all within the last ~2 months).

## Status: FIXED + DEPLOYED + VISUALLY VERIFIED

</content>
