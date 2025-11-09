import { redirect } from 'next/navigation';
import { getUserIdFromJWT } from '@/lib/jwt';

export default async function Home() {
  // Get the user's ID from JWT
  const userId = await getUserIdFromJWT();

  // If user is not authenticated, redirect to login
  if (!userId) {
    redirect('/auth/login');
  }

  // If user is authenticated, redirect to dashboard
  // Note: Setup completion check should be done in the dashboard
  redirect('/dashboard');
}