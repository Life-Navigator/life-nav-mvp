import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const GRAPHRAG_WORKER_SECRET = process.env.GRAPHRAG_WORKER_SECRET;

interface ChatRequest {
  message: string;
  conversation_id?: string;
  previous_messages?: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate via Supabase session
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ChatRequest = await request.json();
    const { message, conversation_id, previous_messages } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Determine streaming mode
    const url = new URL(request.url);
    const shouldStream = url.searchParams.get('stream') === 'true';

    // Call GraphRAG Query Edge Function
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/graphrag-query`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Use worker secret for service-to-service auth
    if (GRAPHRAG_WORKER_SECRET) {
      headers['x-worker-secret'] = GRAPHRAG_WORKER_SECRET;
    }

    const edgeResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: message,
        user_id: user.id,
        stream: shouldStream,
        conversation_id,
        previous_messages,
      }),
    });

    if (!edgeResponse.ok) {
      const errText = await edgeResponse.text();
      console.error('GraphRAG query failed:', errText);
      return NextResponse.json(
        { error: 'AI query failed', details: errText },
        { status: edgeResponse.status },
      );
    }

    // Streaming: pipe SSE through
    if (shouldStream && edgeResponse.body) {
      return new Response(edgeResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Non-streaming: return JSON
    const result = await edgeResponse.json();

    return NextResponse.json({
      message: result.message,
      conversation_id: result.conversation_id || conversation_id || `conv_${Date.now()}`,
      timestamp: new Date().toISOString(),
      sources: result.sources,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Chat route error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
