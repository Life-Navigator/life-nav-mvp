# Error Code Reference

This document provides a comprehensive reference for all error codes used in the Life Navigator Agents system.

## Error Code Structure

Error codes follow the pattern: `DOMAIN_NNN` where:
- `DOMAIN` identifies the subsystem (e.g., AGENT, LLM, GRAPHRAG)
- `NNN` is a unique numeric identifier within that domain

## Base Error

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `LN_0000` | `LifeNavigatorError` | An error occurred | ❌ | 500 |

## Configuration Errors (CONFIG_xxx)

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `CONFIG_001` | `ConfigurationError` | Configuration error | ❌ | 500 |

**When to use**: Configuration validation failures, missing required settings, invalid environment variables.

## Agent Errors (AGENT_xxx)

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `AGENT_001` | `AgentError` | Agent error occurred | ❌ | 500 |
| `AGENT_002` | `AgentInitializationError` | Failed to initialize agent | ❌ | 500 |
| `AGENT_003` | `AgentStateError` | Invalid agent state transition | ❌ | 500 |
| `AGENT_004` | `TaskExecutionError` | Task execution failed | ✅ | 500 |
| `AGENT_005` | `AgentTimeoutError` | Agent task timed out | ✅ | 504 |

**When to use**:
- `AGENT_001`: Generic agent errors that don't fit other categories
- `AGENT_002`: Agent initialization failures (missing dependencies, invalid config)
- `AGENT_003`: Invalid state machine transitions
- `AGENT_004`: Task execution failures that may succeed on retry
- `AGENT_005`: Agent operations that exceeded deadline

## GraphRAG Errors (GRAPHRAG_xxx)

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `GRAPHRAG_100` | `GraphRAGError` | GraphRAG error occurred | ❌ | 500 |
| `GRAPHRAG_101` | `NeptuneConnectionError` | Failed to connect to Neptune database | ✅ | 503 |
| `GRAPHRAG_102` | `PostgresConnectionError` | Failed to connect to PostgreSQL database | ✅ | 503 |
| `GRAPHRAG_103` | `QdrantConnectionError` | Failed to connect to Qdrant vector database | ✅ | 503 |
| `GRAPHRAG_104` | `QueryExecutionError` | Database query execution failed | ✅ | 500 |
| `GRAPHRAG_105` | `EmbeddingGenerationError` | Failed to generate text embeddings | ✅ | 500 |

**When to use**:
- `GRAPHRAG_100`: Generic GraphRAG errors
- `GRAPHRAG_101`: Neptune connection/network issues
- `GRAPHRAG_102`: PostgreSQL connection/network issues
- `GRAPHRAG_103`: Qdrant connection/network issues
- `GRAPHRAG_104`: Query syntax errors, execution timeouts, constraint violations
- `GRAPHRAG_105`: Embedding model failures, invalid input text

## Messaging Errors (MESSAGING_xxx)

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `MESSAGING_200` | `MessagingError` | Messaging error occurred | ❌ | 500 |
| `MESSAGING_201` | `RedisConnectionError` | Failed to connect to Redis | ✅ | 503 |
| `MESSAGING_202` | `RabbitMQConnectionError` | Failed to connect to RabbitMQ | ✅ | 503 |
| `MESSAGING_203` | `MessagePublishError` | Failed to publish message to queue | ✅ | 500 |
| `MESSAGING_204` | `MessageConsumptionError` | Failed to consume message from queue | ✅ | 500 |

**When to use**:
- `MESSAGING_200`: Generic messaging errors
- `MESSAGING_201`: Redis connection/network issues
- `MESSAGING_202`: RabbitMQ connection/network issues
- `MESSAGING_203`: Message publishing failures (queue full, serialization errors)
- `MESSAGING_204`: Message consumption failures (deserialization errors, ack failures)

## LLM Errors (LLM_xxx)

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `LLM_300` | `LLMError` | LLM error occurred | ❌ | 500 |
| `LLM_301` | `LLMConnectionError` | Failed to connect to LLM service | ✅ | 503 |
| `LLM_302` | `LLMTimeoutError` | LLM request timed out | ✅ | 504 |
| `LLM_303` | `LLMResponseError` | Invalid response format from LLM | ❌ | 500 |
| `LLM_304` | `LLMRateLimitError` | LLM rate limit exceeded | ✅ | 429 |

**When to use**:
- `LLM_300`: Generic LLM errors
- `LLM_301`: vLLM service connection failures
- `LLM_302`: LLM requests that exceed timeout threshold
- `LLM_303`: Malformed JSON, missing required fields in response
- `LLM_304`: Rate limit exceeded (should trigger backoff)

## Tool Errors (TOOL_xxx)

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `TOOL_400` | `ToolError` | External tool error occurred | ❌ | 502 |
| `TOOL_401` | `PlaidAPIError` | Plaid API error | ✅ | 502 |
| `TOOL_402` | `CoinbaseAPIError` | Coinbase API error | ✅ | 502 |
| `TOOL_403` | `ADPAPIError` | ADP API error | ✅ | 502 |
| `TOOL_404` | `ToolTimeoutError` | External tool request timed out | ✅ | 504 |

**When to use**:
- `TOOL_400`: Generic external tool/API errors
- `TOOL_401`: Plaid API failures (authentication, rate limits, invalid requests)
- `TOOL_402`: Coinbase API failures
- `TOOL_403`: ADP API failures
- `TOOL_404`: External API timeout errors

## Authentication Errors (AUTH_xxx)

| Code | Exception | Message | Retryable | HTTP Status |
|------|-----------|---------|-----------|-------------|
| `AUTH_500` | `AuthenticationError` | Authentication error | ❌ | 401 |
| `AUTH_501` | `InvalidTokenError` | Invalid authentication token | ❌ | 401 |
| `AUTH_502` | `ExpiredTokenError` | Authentication token has expired | ❌ | 401 |
| `AUTH_503` | `InsufficientPermissionsError` | Insufficient permissions | ❌ | 403 |

**When to use**:
- `AUTH_500`: Generic authentication/authorization errors
- `AUTH_501`: Malformed JWT, invalid signature, token not found
- `AUTH_502`: Valid JWT but expired timestamp
- `AUTH_503`: Valid authentication but insufficient permissions for operation

## HTTP Status Code Mapping

| Status | Meaning | Error Types |
|--------|---------|-------------|
| 401 | Unauthorized | Invalid or expired authentication |
| 403 | Forbidden | Insufficient permissions |
| 429 | Too Many Requests | Rate limiting |
| 500 | Internal Server Error | Generic application errors |
| 502 | Bad Gateway | External API failures |
| 503 | Service Unavailable | Connection failures to dependencies |
| 504 | Gateway Timeout | Operation timeouts |

## Retry Logic

The `@retry_on_error` decorator provides automatic retry with exponential backoff:

```python
from utils.errors import retry_on_error, TaskExecutionError

@retry_on_error(
    max_attempts=3,
    initial_delay=0.1,
    max_delay=10.0,
    exponential_base=2.0
)
async def risky_operation():
    # Only retries if error.retryable is True
    pass
```

**Retryable errors** (marked with ✅):
- Connection errors (503)
- Timeout errors (504)
- Rate limit errors (429)
- Transient failures that may succeed on retry

**Non-retryable errors** (marked with ❌):
- Authentication errors (401, 403)
- Invalid format errors
- Configuration errors
- State transition errors

## Exception Hierarchy

```
LifeNavigatorError (base)
├── ConfigurationError
├── AgentError
│   ├── AgentInitializationError
│   ├── AgentStateError
│   ├── TaskExecutionError
│   └── AgentTimeoutError
├── GraphRAGError
│   ├── NeptuneConnectionError
│   ├── PostgresConnectionError
│   ├── QdrantConnectionError
│   ├── QueryExecutionError
│   └── EmbeddingGenerationError
├── MessagingError
│   ├── RedisConnectionError
│   ├── RabbitMQConnectionError
│   ├── MessagePublishError
│   └── MessageConsumptionError
├── LLMError
│   ├── LLMConnectionError
│   ├── LLMTimeoutError
│   ├── LLMResponseError
│   └── LLMRateLimitError
├── ToolError
│   ├── PlaidAPIError
│   ├── CoinbaseAPIError
│   ├── ADPAPIError
│   └── ToolTimeoutError
└── AuthenticationError
    ├── InvalidTokenError
    ├── ExpiredTokenError
    └── InsufficientPermissionsError
```

## Usage Examples

### Catching Specific Errors

```python
from utils.errors import TaskExecutionError, AgentTimeoutError

try:
    result = await agent.execute_task(task_id)
except AgentTimeoutError as e:
    # Handle timeout specifically
    logger.error("Task timed out", error=e)
    raise
except TaskExecutionError as e:
    # Handle other task failures
    logger.warning("Task failed", error=e)
    # Retry or fallback logic
```

### Using Error Details

```python
from utils.errors import QueryExecutionError

try:
    results = await db.execute_query(query)
except QueryExecutionError as e:
    # Access structured error information
    error_dict = e.to_dict()
    print(error_dict["error_code"])     # "GRAPHRAG_104"
    print(error_dict["retryable"])      # True
    print(error_dict["client_message"]) # Safe for API responses
    print(e.details)                    # Additional debug info
```

### Custom Exception Details

```python
from utils.errors import LLMConnectionError

raise LLMConnectionError(
    "Failed to connect to vLLM instance",
    details={
        "instance": "http://localhost:8000",
        "attempt": 3,
        "error_type": "ConnectionRefused"
    }
)
```

### Exception Chaining

```python
from utils.errors import GraphRAGError

try:
    await neptune_client.connect()
except ConnectionError as e:
    # Chain the original exception
    raise NeptuneConnectionError(
        "Neptune connection failed",
        cause=e,
        details={"endpoint": neptune_client.endpoint}
    )
```

## Best Practices

1. **Always use the most specific exception type** - Use `AgentTimeoutError` instead of generic `AgentError`
2. **Include helpful details** - Add context via the `details` parameter for debugging
3. **Chain exceptions** - Use `cause` to preserve the original exception
4. **Log before raising** - Use the logging system to capture full context
5. **Don't retry non-retryable errors** - Check `error.retryable` before manual retry logic
6. **Use client_message for APIs** - Never expose internal errors to clients

## Adding New Error Codes

When adding new exception classes:

1. Choose the appropriate domain prefix (or create a new one)
2. Pick the next available number in that domain
3. Add to `ERROR_CODE_REGISTRY` in `utils/errors.py`
4. Update this documentation
5. Run `pytest tests/unit/test_errors.py` to ensure uniqueness

Example:

```python
class NewCustomError(ToolError):
    """Description of when to use this error."""

    error_code = "TOOL_405"  # Next available TOOL code
    default_message = "Clear user-facing message"
    retryable = True  # or False
    http_status_code = 502
```
