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
│   ├── airtable.ts   # Airtable API client
│   ├── auth.ts       # API key extraction (param > header > env)
│   ├── errors.ts     # Custom error classes
│   ├── validation.ts # Input sanitization & security
│   ├── rate-limiter.ts
│   ├── cache.ts
│   └── logger.ts     # Structured logging (stderr for stdio)
├── tools/
│   ├── bases.ts      # list_bases
│   ├── tables.ts     # list_tables, create_table, etc.
│   ├── records.ts    # get_records, create_record, etc.
│   └── batch.ts      # batch_upsert, batch_delete
└── types.ts          # TypeScript interfaces
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

API key extraction follows this priority:
1. `airtableApiKey` parameter in tool call (explicit)
2. `x-airtable-api-key` HTTP header (via session.headers)
3. `Authorization: Bearer <token>` header
4. `AIRTABLE_API_KEY` environment variable (fallback)

## Tool Categories

### Bases
- `list_bases` - List accessible Airtable bases

### Tables
- `list_tables` - List tables in a base
- `create_table` - Create new table with fields
- `update_table` - Update table name/description
- `create_field` - Add field to table
- `update_field` - Modify field properties

### Records
- `get_records` - Query records with filters/sort
- `get_record` - Get single record by ID
- `create_record` - Create new record
- `update_record` - Update existing record
- `delete_record` - Delete record

### Batch Operations
- `batch_upsert` - Create/update multiple records (partial failure handling)
- `batch_delete` - Delete multiple records (partial failure handling)

### Schema
- `get_schema` - Get complete base schema

### Attachments
- `upload_attachment` - Upload file to attachment field

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

104 unit tests with 100% coverage on lib utilities:
- `validation.test.ts` - Security validation
- `errors.test.ts` - Error formatting
- `rate-limiter.test.ts` - Rate limiting
- `cache.test.ts` - Cache TTL
- `auth.test.ts` - API key extraction
- `batch.test.ts` - Batch operations

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
