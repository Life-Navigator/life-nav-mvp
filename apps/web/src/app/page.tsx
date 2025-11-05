import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export default async function Home() {
  // Get the user's session
  const session = await getServerSession(authOptions);

  // If user is not authenticated, redirect to login
  if (!session) {
    redirect('/auth/login');
  }

  // If user is authenticated but hasn't completed setup, redirect to onboarding
  if (session.user && !session.user.setupCompleted) {
    redirect(`/onboarding/questionnaire?userId=${session.user.id}`);
  }

  // If user is authenticated and has completed setup, redirect to dashboard
  redirect('/dashboard');
}