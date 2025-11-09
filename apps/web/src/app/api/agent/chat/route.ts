import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { safeParseJSON } from '@/lib/utils/validation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8081';

interface ChatRequest {
  agent_id: string;
  message: string;
  conversation_id?: string;
  context?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await safeParseJSON<ChatRequest>(request);
    const { agent_id, message, conversation_id, context } = body;

    if (!agent_id || !message) {
      return NextResponse.json(
        { error: 'agent_id and message are required' },
        { status: 400 }
      );
    }

    // Check if streaming is requested via query param
    const url = new URL(request.url);
    const shouldStream = url.searchParams.get('stream') === 'true';

    if (shouldStream) {
      // Return streaming response
      return streamChatResponse(userId, agent_id, message, conversation_id, context);
    }

    // Call agent chat endpoint (non-streaming)
    const chatApiResponse = await fetch(`${AGENT_API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user_id: userId,
        agent_id,
        conversation_id,
        context,
      }),
    });

    if (!chatApiResponse.ok) {
      const errorText = await chatApiResponse.text();
      console.error('Agent chat failed:', errorText);
      return NextResponse.json(
        { error: 'Agent chat failed', details: errorText },
        { status: chatApiResponse.status }
      );
    }

    const agentResponse = await chatApiResponse.json();

    // Transform response to expected chat format
    const chatResponse = {
      message: agentResponse.response || agentResponse.message || 'I processed your request.',
      agent_id,
      conversation_id: conversation_id || agentResponse.conversation_id || `conv_${Date.now()}`,
      timestamp: new Date().toISOString(),
      context: agentResponse.context,
    };

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error('Error in chat proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function streamChatResponse(
  userId: string,
  agentId: string,
  message: string,
  conversationId?: string,
  context?: Record<string, any>
) {
  // First, get the full response from the agent
  const chatApiResponse = await fetch(`${AGENT_API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      user_id: userId,
      agent_id: agentId,
      conversation_id: conversationId,
      context,
    }),
  });

  if (!chatApiResponse.ok) {
    throw new Error(`Agent chat failed: ${chatApiResponse.statusText}`);
  }

  const agentResponse = await chatApiResponse.json();
  const fullMessage = agentResponse.response || agentResponse.message || 'I processed your request.';

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Split message into words for streaming effect
        const words = fullMessage.split(' ');

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const chunk = i === 0 ? word : ' ' + word;

          // Send the word
          controller.enqueue(encoder.encode(chunk));

          // Add delay between words for typing effect (adjust speed here)
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        // Send metadata at the end
        controller.enqueue(encoder.encode('\n\n__METADATA__\n'));
        controller.enqueue(encoder.encode(JSON.stringify({
          agent_id: agentId,
          conversation_id: conversationId || agentResponse.conversation_id || `conv_${Date.now()}`,
          timestamp: new Date().toISOString(),
          context: agentResponse.context,
        })));

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
