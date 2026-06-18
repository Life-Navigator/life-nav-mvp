import { redirect } from 'next/navigation';

// The standalone /email app is retired for the pilot — Email is "Coming soon" and lives at
// /dashboard/email. This redirect prevents a parallel, non-functional inbox UI (which contradicted
// the coming-soon promise and could not work without provisioned OAuth) from being reachable by URL.
export default function EmailRedirect() {
  redirect('/dashboard/email');
}
