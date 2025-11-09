import { getUserIdFromJWT } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { GetServerSidePropsContext } from 'next';

/**
 * Check if a user is authenticated for server-side requests
 */
export async function isAuthenticated(req: NextRequest | Request | null = null): Promise<boolean> {
  const userId = await getUserIdFromJWT(req || undefined);
  return !!userId;
}

/**
 * Get the current user's ID if authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  return await getUserIdFromJWT();
}

/**
 * Middleware to protect API routes
 */
export async function authMiddleware(req: NextRequest | Request): Promise<NextResponse | null> {
  const isAuthed = await isAuthenticated(req);
  
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return null; // Continue with the request if authenticated
}

/**
 * Helper for protected pages in getServerSideProps
 */
export async function requireAuth(context: GetServerSidePropsContext) {
  const userId = await getUserIdFromJWT();

  if (!userId) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }

  return { props: { userId } };
}

/**
 * Attach user info to context
 */
export async function withAuthContext(context: GetServerSidePropsContext) {
  const userId = await getUserIdFromJWT();

  if (!userId) {
    return { props: { userId: null } };
  }

  return { props: { userId } };
}