# MCP Airtable - Clean FastMCP Implementation

**Minimal, production-ready TypeScript MCP server** for Airtable integration using Node.js FastMCP framework.

## Features

- ✅ **10 Essential Tools** - Complete CRUD + batch operations
- ✅ **Streamable-HTTP Transport** - Claude Desktop 2025+ native support  
- ✅ **Header-based Authentication** - API keys from Claude Desktop client
- ✅ **Production Security** - Formula injection prevention, path traversal blocking
- ✅ **Clean Architecture** - ~8 files, <500 lines total
- ✅ **Zero Dependencies Bloat** - Only essential packages

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

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/mcp",
        "--header",
        "x-airtable-api-key:YOUR_AIRTABLE_API_KEY"
      ]
    }
  }
}
```

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

## Authentication Priority

API keys are extracted in this order:
1. **Tool parameter** - `airtableApiKey` in request
2. **HTTP header** - `x-airtable-api-key` from Claude Desktop
3. **Environment variable** - `AIRTABLE_API_KEY` in .env

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
PORT=3000                 # Server port
NODE_ENV=production       # Environment
AIRTABLE_API_KEY=         # Optional fallback API key
```

## License

MIT

## Credits

Built with [FastMCP](https://github.com/punkpeye/fastmcp) - Clean TypeScript framework for MCP servers.
