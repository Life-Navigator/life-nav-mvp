import { redirect } from 'next/navigation';

// The standalone "Financial Dashboard" was consolidated into the canonical Finance Overview
// (/dashboard/finance/overview), which reads the single canonical finance summary (one source of
// truth for net worth, accounts, liabilities, spending, insights). This route now redirects there
// so there is ONE finance surface to maintain instead of two that could disagree. The prior legacy
// dashboard component remains in git history if ever needed. (2026-06-25)
export default function FinancePage() {
  redirect('/dashboard/finance/overview');
}
