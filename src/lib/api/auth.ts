import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextRequest, NextResponse } from 'next/server';
import { GetServerSidePropsContext } from 'next';

/**
 * Check if a user is authenticated for server-side requests
 */
export async function isAuthenticated(req: NextRequest | Request | null = null): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user?.id;
}

/**
 * Get the current user's ID if authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
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
  const session = await getServerSession(
    context.req,
    context.res,
    authOptions
  );

  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }
  
  return { props: { user: session.user } };
}

/**
 * Attach user info to context
 */
export async function withAuthContext(context: GetServerSidePropsContext) {
  const session = await getServerSession(
    context.req,
    context.res,
    authOptions
  );

  if (!session) {
    return { props: { user: null } };
  }
  
  return { props: { user: session.user } };
}