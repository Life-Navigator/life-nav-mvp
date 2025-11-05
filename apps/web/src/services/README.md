# Agent Proxy Service

## Overview

The Agent Proxy Service (`agent-proxy.ts`) handles all communication between the LifeNavigator platform and the agent system. It provides a robust, type-safe layer with retry logic, timeout handling, and comprehensive error management.

## Features

- ✅ **Type-Safe Communication** - Full TypeScript support with strict typing
- ✅ **Automatic Retries** - Exponential backoff retry logic for 5xx errors
- ✅ **Timeout Handling** - Configurable request timeouts with AbortController
- ✅ **Request Validation** - Validates all requests before sending
- ✅ **Response Validation** - Type-checks all agent responses
- ✅ **Error Handling** - Custom error types for different failure scenarios
- ✅ **Logging** - Comprehensive logging with request IDs for tracing
- ✅ **Singleton Pattern** - Pre-configured instance ready to use

## Usage

### Basic Example

```typescript
import { agentProxy } from '@/services/agent-proxy';

// Send a message to the agent system
const response = await agentProxy.send({
  user_id: 'user-uuid-here',
  message: 'How should I plan my retirement?',
  context: {
    session_id: 'session-uuid-here',
    domain: 'finance',
  },
  action: 'chat',
});

if (response.success) {
  console.log('Agent response:', response.data.response);
  console.log('Agent:', response.data.agent_name);
  console.log('Confidence:', response.data.confidence);
} else {
  console.error('Agent error:', response.error);
}
```

### Advanced Example with Context

```typescript
import { agentProxy } from '@/services/agent-proxy';

const response = await agentProxy.send({
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  message: 'Should I refinance my mortgage?',
  context: {
    session_id: '550e8400-e29b-41d4-a716-446655440001',
    domain: 'finance',
    previous_messages: [
      {
        role: 'user',
        content: 'I have a 30-year mortgage at 6.5%',
      },
      {
        role: 'agent',
        content: 'Current rates are around 5.2%. Let me analyze...',
      },
    ],
    user_profile: {
      credit_score: 750,
      income: 120000,
      mortgage_balance: 300000,
    },
  },
  action: 'analyze',
  metadata: {
    request_id: 'custom-request-id',
    timestamp: new Date().toISOString(),
    environment: 'production',
  },
});
```

### Custom Configuration

```typescript
import { AgentProxy } from '@/services/agent-proxy';

const customProxy = new AgentProxy({
  baseUrl: 'https://agents.yourdomain.com',
  timeout: 60000, // 1 minute
  retries: 5,
  retryDelayMs: 2000, // 2 second base delay
});

const response = await customProxy.send({
  // ... request
});
```

## Request Types

### AgentRequest

```typescript
interface AgentRequest {
  user_id: string;           // UUID from authenticated user
  message: string;           // User's input message
  context: {
    domain?: string;         // finance, career, health, legal, personal
    session_id: string;       // Current conversation session
    previous_messages?: Array<{
      role: 'user' | 'agent';
      content: string;
    }>;
    user_profile?: Record<string, unknown>;
  };
  action: 'onboarding' | 'chat' | 'quick_response' | 'analyze';
  metadata?: {
    request_id: string;
    timestamp: string;        // ISO 8601
    environment: 'development' | 'staging' | 'production';
  };
}
```

### AgentResponse

```typescript
interface AgentResponse {
  success: boolean;
  data?: {
    response: string;         // Main response text
    agent_name: string;       // Which agent responded
    confidence?: number;      // 0-100
    sources?: string[];       // Data sources used
    action_items?: Array<{
      action: string;
      timeline?: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    escalation?: {
      required: boolean;
      type?: 'financial' | 'legal' | 'medical' | 'crisis';
      reason: string;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  };
  metrics: {
    response_time_ms: number;
    tokens_used?: number;
    model_version: string;
  };
}
```

## Error Handling

The service provides three custom error types:

### AgentProxyError

Generic error for agent communication failures.

```typescript
try {
  const response = await agentProxy.send(request);
} catch (error) {
  if (error instanceof AgentProxyError) {
    console.error('Agent error:', error.code, error.message);
    console.error('Details:', error.details);
  }
}
```

### AgentTimeoutError

Thrown when a request exceeds the configured timeout.

```typescript
try {
  const response = await agentProxy.send(request);
} catch (error) {
  if (error instanceof AgentTimeoutError) {
    console.error('Request timed out');
    console.error('Request ID:', error.requestId);
  }
}
```

### AgentValidationError

Thrown when request or response validation fails.

```typescript
import { AgentValidationError } from '@/types/agents';

try {
  const response = await agentProxy.send(invalidRequest);
} catch (error) {
  if (error instanceof AgentValidationError) {
    console.error('Validation failed:', error.message);
    console.error('Field:', error.details?.field);
  }
}
```

## Retry Logic

The service automatically retries requests on failures with exponential backoff:

- **5xx errors**: Retried up to `config.retries` times
- **4xx errors**: NOT retried (client errors)
- **Network errors**: Retried up to `config.retries` times
- **Timeout errors**: Retried up to `config.retries` times

### Retry Delay Formula

```
delay = retryDelayMs * (2 ^ (attempt - 1))

Examples (retryDelayMs = 1000):
- Attempt 1: 1000ms (1 second)
- Attempt 2: 2000ms (2 seconds)
- Attempt 3: 4000ms (4 seconds)
```

## Configuration

Set the following environment variables in `.env.local`:

```bash
# Agent API endpoint
AGENT_API_URL=http://localhost:8000

# Request timeout in milliseconds (default: 30000)
AGENT_TIMEOUT=30000

# Number of retry attempts (default: 3)
AGENT_RETRIES=3

# Base retry delay in milliseconds (default: 1000)
AGENT_RETRY_DELAY=1000
```

## Logging

All requests and responses are logged with request IDs for tracing:

```typescript
// Successful request
[INFO] Agent request successful {
  request_id: 'req_1699123456789_abc123',
  action: 'chat',
  response_time_ms: 1234,
  agent_name: 'finance_manager'
}

// Retry attempt
[WARN] Retrying request after error {
  attempt: 2,
  maxAttempts: 3,
  delay: 2000,
  error: 'HTTP 503'
}

// Failed request
[ERROR] Agent request failed {
  request_id: 'req_1699123456789_abc123',
  error: 'Request timed out after 30000ms'
}
```

## Testing

Run tests with:

```bash
npm test src/services/__tests__/agent-proxy.test.ts
```

Test coverage includes:
- ✅ Request validation
- ✅ Response validation
- ✅ Retry logic with exponential backoff
- ✅ Timeout handling
- ✅ Error handling
- ✅ HTTP headers
- ✅ Metadata enrichment

## API Endpoint

The agent proxy sends requests to:

```
POST {AGENT_API_URL}/api/v1/agent/message
```

Make sure your agent system is running and accessible at the configured URL.

## Best Practices

1. **Always use the singleton instance** (`agentProxy`) unless you need custom configuration
2. **Include session_id** in all requests for conversation continuity
3. **Use request_id** for tracing and debugging
4. **Handle both success and error cases** in your UI
5. **Display loading states** during agent requests (they can take 5-30 seconds)
6. **Implement retry UI** for timeout errors
7. **Log all agent interactions** for auditing and debugging

## Troubleshooting

### "Agent request timed out"

- Check that AGENT_API_URL is correct
- Verify agent system is running
- Increase AGENT_TIMEOUT if requests are legitimately slow
- Check network connectivity

### "Validation error: user_id is required"

- Ensure you're passing authenticated user's UUID
- Check that user is logged in
- Verify session is valid

### "HTTP 503" errors with retries

- Agent system may be overloaded
- Check agent system logs
- Consider scaling agent infrastructure

### No response after request

- Check browser console for errors
- Verify WebSocket connection (if using streaming)
- Check that environment variables are loaded

## Migration Notes

If migrating from direct agent calls:

**Before:**
```typescript
const response = await fetch('http://localhost:8000/api/agent', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello' }),
});
```

**After:**
```typescript
const response = await agentProxy.send({
  user_id: userId,
  message: 'Hello',
  context: { session_id: sessionId },
  action: 'chat',
});
```

## Related Documentation

- [Agent Types](/src/types/agents.ts) - TypeScript types for agent communication
- [System Prompt Manager](/src/lib/system-prompt-manager.ts) - Manages agent prompts
- [WebSocket Client](/src/lib/websocket.ts) - Real-time communication

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review test cases for usage examples
- Check agent system logs for backend errors
- Create an issue with request_id for debugging
