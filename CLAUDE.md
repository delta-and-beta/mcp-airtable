# MCP Airtable Server

## Project Overview

This is a Model Context Protocol (MCP) server providing Airtable integration. Built for **remote deployment** (Streamable HTTP) with **local compatibility** (stdio).

## MCP Transport Standards (2025-11-25 Spec)

### Primary: Streamable HTTP (Remote)

The server is designed for remote deployment using **Streamable HTTP transport** - the current MCP standard (2025-11-25).

**Key characteristics:**
- Single HTTP endpoint supporting POST and GET methods
- Session management via `MCP-Session-Id` header
- Supports multiple concurrent client connections
- Stateless or stateful operation modes

**Endpoint structure:**
```
POST /mcp - Client sends JSON-RPC messages
GET /mcp  - Client listens for server-initiated messages (optional streaming)
```

**Required headers (MCP 2025-11-25):**
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`
- `MCP-Protocol-Version: 2025-11-25`
- `MCP-Session-Id: <session-id>` (after initialization)

### Secondary: stdio (Local Development)

For local development and Claude Desktop integration:
- Server runs as subprocess
- Reads JSON-RPC from stdin, writes to stdout
- Logs go to stderr only (stdout is reserved for protocol)
- Use `--stdio` flag to enable

## Architecture

```
src/
├── index.ts          # Entry point (transport selection)
├── server.ts         # FastMCP server initialization
├── lib/
│   ├── airtable.ts   # Re-exports from airtable/ module
│   ├── airtable/     # Modular Airtable client
│   │   ├── index.ts  # Module exports
│   │   ├── client.ts # AirtableClient class
│   │   ├── fetch.ts  # fetchWithDetails utility
│   │   ├── types.ts  # Shared TypeScript interfaces
│   │   └── mime-types.ts # MIME type utilities
│   ├── auth.ts       # API key & workspace ID extraction (header > param > env)
│   ├── errors.ts     # Custom error classes
│   ├── validation.ts # Input sanitization & security
│   ├── rate-limiter.ts
│   ├── cache.ts
│   ├── config.ts     # Environment validation
│   ├── logger.ts     # Structured logging (stderr for stdio)
│   └── sentry.ts     # Error tracking (optional)
├── tools/
│   ├── bases.ts      # list_workspaces, list_bases, get_base_schema, create_base
│   ├── tables.ts     # list_tables, create_table, update_table
│   ├── fields.ts     # create_field, update_field, upload_attachment
│   ├── records.ts    # get_records, get_record, create_records, update_record, delete_record
│   ├── batch.ts      # upsert_records, delete_records
│   └── comments.ts   # list_comments, create_comment, update_comment, delete_comment
└── __tests__/
    ├── unit/         # Unit tests (133 tests)
    └── e2e/          # End-to-end tests
```

## Configuration

### Remote Deployment (Streamable HTTP)

```bash
# Default: HTTP on port 3000
node dist/index.js

# Custom port
PORT=8080 node dist/index.js
```

Environment variables:
- `PORT` - HTTP port (default: 3000)
- `AIRTABLE_API_KEY` - Default API key (optional, can be per-request)
- `LOG_LEVEL` - debug|info|warn|error (default: info)
- `NODE_ENV` - production for JSON logs

### Local Development (stdio)

```bash
node dist/index.js --stdio
```

Claude Desktop config:
```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "node",
      "args": ["/path/to/dist/index.js", "--stdio"],
      "env": {
        "AIRTABLE_API_KEY": "pat..."
      }
    }
  }
}
```

## Authentication (FastMCP Best Practice)

### Server Configuration

The server uses FastMCP's `authenticate` callback to capture HTTP headers and store them in the session:

```typescript
interface SessionData {
  headers: IncomingHttpHeaders;
  [key: string]: unknown;
}

const server = new FastMCP<SessionData>({
  name: "mcp-airtable",
  authenticate: async (request): Promise<SessionData> => ({
    headers: request.headers,  // Store in session for tools
  }),
});
```

### Tool Access

Tools access headers via `context.session.headers`:

```typescript
execute: async (args, context) => {
  const apiKey = context.session?.headers?.["x-airtable-api-key"];
}
```

### Priority Order

**API key extraction (header > parameter > env):**
1. `x-airtable-api-key` HTTP header (via session.headers - recommended)
2. `Authorization: Bearer <token>` header
3. `airtableApiKey` parameter in tool call (explicit override)
4. `AIRTABLE_API_KEY` environment variable (fallback)

**Workspace ID extraction (header > parameter > env):**
1. `x-airtable-workspace-id` HTTP header (via session.headers - set once)
2. `workspaceId` parameter in tool call
3. `AIRTABLE_WORKSPACE_ID` environment variable (fallback)

## Tool Categories (24 Total)

### Health & Monitoring (3)
- `health_check` - Detailed health status (circuit breakers, memory, uptime)
- `liveness` - Liveness probe (is service running?)
- `readiness` - Readiness probe (is service ready to accept requests?)

### Base & Workspace Management (4)
- `list_workspaces` - List workspaces (Enterprise plan required, provides UI workaround)
- `list_bases` - List accessible Airtable bases
- `get_base_schema` - Get complete base schema
- `create_base` - Create new base in a workspace

### Tables (3)
- `list_tables` - List tables in a base
- `create_table` - Create new table with fields
- `update_table` - Update table name/description

### Fields & Attachments (3)
- `create_field` - Add field to table
- `update_field` - Modify field name/description
- `upload_attachment` - Upload file to attachment field

### Records (5)
- `get_records` - Query records with filters/sort
- `get_record` - Get single record by ID
- `create_records` - Create new record(s)
- `update_record` - Update existing record
- `delete_record` - Delete record

### Batch Operations (2)
- `upsert_records` - Create/update multiple records (partial failure handling)
- `delete_records` - Delete multiple records (partial failure handling)

### Comments (4)
- `list_comments` - List comments on a record
- `create_comment` - Add comment to a record
- `update_comment` - Update existing comment
- `delete_comment` - Delete comment

## Error Handling

All tools return consistent error responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Description of the error",
    "details": { ... }
  }
}
```

Error types:
- `AuthenticationError` - Missing/invalid API key
- `ValidationError` - Invalid input parameters
- `AirtableError` - Airtable API errors (includes status code)
- `RateLimitError` - Rate limit exceeded (includes retryAfter)
- `TimeoutError` - Request timed out (includes timeoutMs, url)
- `CircuitBreakerError` - Circuit breaker is open (includes circuitName, nextRetryTime)

## Circuit Breaker Pattern

Prevents cascading failures by failing fast when a service is unhealthy:

**States:**
- `CLOSED` - Normal operation, requests pass through
- `OPEN` - Service failing, requests rejected immediately
- `HALF_OPEN` - Testing recovery, limited requests allowed

**Default Configuration:**
- Failure threshold: 5 failures to open circuit
- Reset timeout: 30000ms before testing recovery
- Success threshold: 2 successes in half-open to close
- Failure window: 60000ms (only count recent failures)

**Usage:**
```typescript
import { getCircuitBreaker } from "./lib/circuit-breaker.js";

const breaker = getCircuitBreaker("airtable-api", {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

// Execute with protection
const result = await breaker.execute(() => fetchWithDetails(url, options));

// Or check manually
if (breaker.canRequest()) {
  try {
    const result = await fetchWithDetails(url, options);
    breaker.recordSuccess();
  } catch (error) {
    breaker.recordFailure(error);
    throw error;
  }
}
```

## Retry with Exponential Backoff

All API requests automatically retry on transient failures:

**Retryable HTTP Status Codes:** 429, 500, 502, 503, 504

**Retryable Network Errors:** ECONNRESET, ETIMEDOUT, ECONNREFUSED, EPIPE, EAI_AGAIN

**Retryable Errors:** Timeout errors (request exceeds configured timeout)

**Default Configuration:**
- Max retries: 3
- Initial delay: 1000ms
- Max delay: 30000ms
- Jitter: 10% (prevents thundering herd)
- **Timeout: 30000ms per request attempt**

**Retry-After Header:** Automatically respected for 429 rate limits

**Request Timeout:** Each request attempt has its own timeout using AbortController. If a request exceeds the timeout, it throws `TimeoutError` and can be retried.

**Custom timeout for specific requests:**
```typescript
await fetchWithDetails(url, { timeoutMs: 60000 }); // 60 second timeout
```

**Disable retry for specific requests:**
```typescript
await fetchWithDetails(url, { noRetry: true });
```

## Security

### Input Validation
- Path traversal prevention
- SQL injection pattern detection in formulas
- Dangerous file extension blocking
- Base64 size limits (10MB max)

### Blocked Patterns
- System directories (/etc, /var, /usr, etc.)
- Dangerous functions (EVAL, EXEC, SYSTEM)
- SQL keywords in formulas (SELECT, DROP, DELETE)

## Monitoring (Sentry)

Optional error tracking via Sentry integration:

```bash
# Enable Sentry (disabled by default)
SENTRY_DSN=https://xxx@o0.ingest.sentry.io/0

# Debug mode - capture ALL MCP requests
SENTRY_DEBUG=true
```

Features:
- Error capture with tool context
- Debug mode for full request tracing
- Sensitive data redaction (API keys never sent)
- Graceful shutdown with event flushing

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Development (auto-reload)
npm run dev
```

## Testing

### Unit Tests

158 unit tests with 100% coverage on lib utilities:
- `validation.test.ts` - Security validation (28 tests)
- `errors.test.ts` - Error formatting (19 tests)
- `rate-limiter.test.ts` - Rate limiting (11 tests)
- `cache.test.ts` - Cache TTL (16 tests)
- `auth.test.ts` - API key & workspace ID extraction (32 tests)
- `batch.test.ts` - Batch operations (9 tests)
- `fields.test.ts` - Field management (18 tests)
- `retry.test.ts` - Retry with exponential backoff (25 tests)

### End-to-End Tests (25 tests)

E2E tests run against the live Airtable API. They automatically:
1. List existing bases to find next available "Testing N" name
2. Create a new "Testing N" base for the test run
3. Run all 25 tests against that base (including 200 record batch test and PDF upload/download validation)
4. Clean up records (base must be deleted manually)

**Batch Testing:**
- Creates 200 records in 20 batches of 10
- Tests rate limiting with 100ms delay between batches
- Verifies all records created successfully (~2+ seconds total)

**Requirements:**
```bash
# Set environment variables
export AIRTABLE_API_KEY="patXXXXXXXXXXXXXX"
export AIRTABLE_WORKSPACE_ID="wspXXXXXXXXXXXXXX"

# Run e2e tests
npm run test:e2e
```

**Using Claude Desktop credentials:**
Get credentials from `~/Library/Application Support/Claude/claude_desktop_config.json`:
- `x-airtable-api-key` header value → `AIRTABLE_API_KEY`
- `x-airtable-workspace-id` header value → `AIRTABLE_WORKSPACE_ID`

**Note:** Each test run creates a new base (Testing 1, Testing 2, etc.). Delete unused test bases manually from the Airtable UI.

## Development Workflow

### Feature Completion Checklist

**IMPORTANT:** After completing any feature, always run both unit and e2e tests before merging:

```bash
# 1. Run unit tests
npm test

# 2. Extract credentials from Claude Desktop config and run e2e tests
# Note: Credentials are in --header args, not env vars
export AIRTABLE_API_KEY=$(cat "/Users/$USER/Library/Application Support/Claude/claude_desktop_config.json" | jq -r '.mcpServers["mcp-airtable"].args[]' | grep "x-airtable-api-key" | cut -d: -f2)
export AIRTABLE_WORKSPACE_ID=$(cat "/Users/$USER/Library/Application Support/Claude/claude_desktop_config.json" | jq -r '.mcpServers["mcp-airtable"].args[]' | grep "x-airtable-workspace-id" | cut -d: -f2)

# 3. Run e2e tests
npm run test:e2e

# 4. Only merge if all tests pass
```

**Why e2e tests matter:**
- Unit tests verify internal logic but not actual Airtable API integration
- E2e tests catch issues with API changes, authentication, rate limiting
- E2e tests verify the full request/response cycle works correctly

### E2E Test Result Summary

After running e2e tests, always summarize results in a table format:

| Metric | Result |
|--------|--------|
| Unit Tests | X passed |
| E2E Tests | X passed |
| Test Base | [Testing N](https://airtable.com/appXXXXXXXXXXXXX) |
| Records Created | X |
| Duration | Xs |

**Example:**
| Metric | Result |
|--------|--------|
| Unit Tests | 272 passed |
| E2E Tests | 25 passed |
| Test Base | [Testing 8](https://airtable.com/appwrfoyFCetjF3H1) |
| Records Created | 204 |
| Duration | 28s |

**Note:** Test bases are preserved for review. Delete manually from Airtable when no longer needed.

## Important Notes

### stdio Transport Requirements
- **NEVER** write to stdout except JSON-RPC messages
- All logging MUST go to stderr
- This is critical for Claude Desktop compatibility

### Batch Operations
- Processes in chunks of 10 (Airtable limit)
- Continues on partial failure
- Returns detailed success/failure report

## References

- [MCP Specification (Latest)](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP Versioning](https://modelcontextprotocol.io/specification/versioning)
- [Airtable API](https://airtable.com/developers/web/api/introduction)
