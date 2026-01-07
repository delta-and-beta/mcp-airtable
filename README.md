# MCP Airtable - Clean FastMCP Implementation

**Minimal, production-ready TypeScript MCP server** for Airtable integration using Node.js FastMCP framework.

## Features

### Core Functionality
- ✅ **10 Essential Tools** - Complete CRUD + batch operations
- ✅ **Streamable-HTTP Transport** - Claude Desktop 2025+ native support
- ✅ **Header-based Authentication** - API keys from Claude Desktop client

### Production Ready
- ✅ **Custom Error Classes** - Proper error handling with status codes
- ✅ **Structured Logging** - JSON logs in production, pretty logs in dev
- ✅ **Response Caching** - 5-10min TTL for metadata (list_bases, get_schema)
- ✅ **Rate Limiting** - 60 req/min default, configurable
- ✅ **Environment Validation** - Zod-validated configuration

### Security Hardening
- ✅ **Formula Injection Prevention** - Blocks EVAL, EXEC, SQL patterns
- ✅ **Path Traversal Blocking** - Validates all file paths
- ✅ **Input Validation** - Zod schemas for all tool parameters
- ✅ **Base64 Validation** - Size limits and format checking

### Clean Architecture
- ✅ **8 Core Files** - ~900 lines total (vs 5000+ in traditional implementations)
- ✅ **Zero Bloat** - Only essential dependencies (FastMCP, Zod, Airtable, dotenv)
- ✅ **Type Safe** - TypeScript strict mode
- ✅ **Well Organized** - tools/ lib/ clear separation

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Run Server

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

Server starts on **http://localhost:3000/mcp** with streamable-HTTP transport.

### Claude Desktop Configuration

See [`examples/`](./examples/) for complete configuration examples.

#### Option 1: Local Development (stdio)

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/dist/index.js", "--stdio"],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXX.XXXXX..."
      }
    }
  }
}
```

#### Option 2: Remote HTTP (Claude Desktop with mcp-remote)

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3001/mcp",
        "--header",
        "x-airtable-api-key:patXXXXX.XXXXX..."
      ]
    }
  }
}
```

#### Option 3: Remote Server (Claude.ai Web)

Deploy to any hosting provider, then connect via Claude.ai:

1. Deploy: `npm start` (runs on port 3000)
2. Open [claude.ai](https://claude.ai) → Settings → Connectors
3. Add custom connector: `https://your-server.com/mcp`
4. Add header: `x-airtable-api-key: patXXXXX.XXXXX...`

**Config location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Get your API key:** https://airtable.com/create/tokens

## Available Tools

### Metadata Tools
- **list_bases** - List all accessible Airtable bases
- **list_tables** - List tables in a base with field definitions
- **get_schema** - Get complete base schema (tables, fields, views)

### Record Operations
- **get_records** - Query records with filtering and sorting
- **get_record** - Get single record by ID
- **create_record** - Create new records
- **update_record** - Update existing records
- **delete_record** - Delete records permanently

### Batch Operations
- **batch_upsert** - Create or update up to 1000 records
- **batch_delete** - Delete up to 1000 records

## Architecture

```
src/
├── index.ts              # Entry point
├── server.ts             # FastMCP initialization
├── tools/                # Tool definitions
│   ├── bases.ts          # Metadata tools
│   ├── tables.ts         # Table tools
│   ├── records.ts        # CRUD operations
│   └── batch.ts          # Batch operations
└── lib/                  # Utilities
    ├── airtable.ts       # Airtable client
    ├── auth.ts           # API key extraction
    └── validation.ts     # Security sanitization
```

**Total: 8 files, ~450 lines of code**

## Usage Examples

### List Bases
```
"Using airtable, list my bases"
```

### Query Records
```
"Get records from the Tasks table where Status equals Active"
```

### Create Record
```
"Create a new task with Name='Test' and Status='Todo'"
```

### Batch Operations
```
"Create 5 test tasks in the Tasks table"
```

## Authentication (FastMCP Best Practice)

The server uses FastMCP's `authenticate` callback to capture HTTP headers and store them in the session, allowing tools to access headers via `context.session.headers`.

**API key priority:**
1. **Tool parameter** - `airtableApiKey` in request (explicit)
2. **HTTP header** - `x-airtable-api-key` via session (recommended for HTTP)
3. **Bearer token** - `Authorization: Bearer <token>` header
4. **Environment variable** - `AIRTABLE_API_KEY` (fallback for stdio)

## Security Features

- ✅ **Formula injection prevention** - Blocks EVAL, EXEC, SQL patterns
- ✅ **Path traversal blocking** - Validates all file paths
- ✅ **Input validation** - Zod schemas for all parameters
- ✅ **Base64 validation** - Size limits and format checking

## Development

```bash
# Start with auto-reload
npm run dev

# Type check
npm run build

# Clean build
rm -rf dist && npm run build
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
docker build -t mcp-airtable .
docker run -p 3000:3000 -e AIRTABLE_API_KEY=your_key mcp-airtable
```

### Environment Variables

```bash
# Server
PORT=3000                              # Server port (default: 3000)
NODE_ENV=production                    # Environment mode

# Authentication
AIRTABLE_API_KEY=                      # Optional server-level API key (not recommended - use headers)

# Rate Limiting
RATE_LIMIT_ENABLED=true                # Enable rate limiting (default: true)
RATE_LIMIT_REQUESTS_PER_MINUTE=60      # Max requests per minute (default: 60)

# Caching
CACHE_ENABLED=true                     # Enable response caching (default: true)
CACHE_TTL_BASES=300                    # list_bases cache TTL in seconds (default: 300)
CACHE_TTL_SCHEMA=600                   # get_schema cache TTL in seconds (default: 600)
CACHE_TTL_TABLES=300                   # list_tables cache TTL in seconds (default: 300)

# Logging
LOG_LEVEL=info                         # Logging level: debug, info, warn, error (default: info)
```

**Note:** In production, API keys should come from **client headers**, not server environment variables. This enables multi-tenant usage.

## License

MIT

## References

- [MCP Specification (Latest)](https://modelcontextprotocol.io/specification/2025-11-25)
- [FastMCP](https://github.com/punkpeye/fastmcp) - TypeScript framework for MCP servers
- [mcp-remote](https://www.npmjs.com/package/mcp-remote) - Bridge for Claude Desktop HTTP connections
- [Airtable API](https://airtable.com/developers/web/api/introduction)
