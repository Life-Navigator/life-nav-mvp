import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { analysis } = body;

    // Store the analysis (you might want to create a ConversationAnalysis model)
    // For now, we'll store it as JSON in the user's metadata
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...(await prisma.user.findUnique({
            where: { id: userId },
            select: { metadata: true }
          }))?.metadata as any || {},
          conversationAnalysis: {
            ...analysis,
            completedAt: new Date(),
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Analysis saved successfully'
    });
  } catch (error) {
    console.error('Error saving conversation analysis:', error);
    return NextResponse.json(
      { error: 'Failed to save analysis' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true }
    });

    const analysis = (user?.metadata as any)?.conversationAnalysis || null;

    return NextResponse.json({
      analysis,
      hasAnalysis: !!analysis
    });
  } catch (error) {
    console.error('Error fetching conversation analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}