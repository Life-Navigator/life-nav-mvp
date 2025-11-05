import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { ConnectedService } from '@/types/integration';

/**
 * GET /api/integrations/services
 * Fetches all connected services for the authenticated user
 */
export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Query database for user's connected services
    // const services = await prisma.connectedService.findMany({
    //   where: {
    //     userId: session.user.id,
    //   },
    //   include: {
    //     provider: true,
    //   },
    // });

    // For now, return empty array - will be populated when users connect services
    const services: ConnectedService[] = [];

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching connected services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connected services' },
      { status: 500 }
    );
  }
}
