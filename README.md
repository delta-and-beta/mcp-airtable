<div align="center">

# MCP Airtable

**Production-ready MCP server for Airtable integration**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)
[![Tests](https://img.shields.io/badge/Tests-297%20passing-brightgreen?style=flat-square)](./src/__tests__)

Built with [FastMCP](https://github.com/punkpeye/fastmcp) • Works with Claude Desktop & Claude.ai

---

</div>

## Overview

A minimal, enterprise-grade MCP server that enables AI assistants to interact with Airtable. Features 21 tools covering complete CRUD operations, batch processing, schema management, and file attachments.

<br>

## ✨ Highlights

<table>
<tr>
<td width="50%">

### Core
- **21 Tools** — Full CRUD, batch ops, attachments
- **Streamable HTTP** — Claude Desktop 2025+ native
- **Header Auth** — Multi-tenant ready

</td>
<td width="50%">

### Reliability
- **Circuit Breaker** — Cascading failure prevention
- **Auto-Retry** — Exponential backoff with jitter
- **Health Checks** — K8s liveness/readiness probes

</td>
</tr>
<tr>
<td width="50%">

### Security
- **Input Validation** — Zod schemas everywhere
- **Injection Prevention** — Formula & path attacks blocked
- **Audit Ready** — See [SECURITY.md](./SECURITY.md)

</td>
<td width="50%">

### Performance
- **Connection Pooling** — Keep-alive via undici
- **Request Deduplication** — Shares concurrent results
- **Response Caching** — 5-10min TTL for metadata

</td>
</tr>
</table>

<br>

## 🚀 Quick Start

```bash
# Install & build
npm install && npm run build

# Run server (starts on http://localhost:3000/mcp)
npm start
```

<br>

## ⚙️ Configuration

### Claude Desktop

<details>
<summary><strong>Option 1: Local Development (stdio)</strong></summary>

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

</details>

<details>
<summary><strong>Option 2: Remote HTTP (via mcp-remote)</strong></summary>

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://your-server.com/mcp",
        "--header", "x-airtable-api-key:patXXXXX.XXXXX...",
        "--header", "x-airtable-workspace-id:wspXXXXXXXXXXX"
      ]
    }
  }
}
```

</details>

<details>
<summary><strong>Option 3: Claude.ai Web</strong></summary>

1. Deploy server: `npm start`
2. Open [claude.ai](https://claude.ai) → Settings → Connectors
3. Add connector URL: `https://your-server.com/mcp`
4. Add header: `x-airtable-api-key: patXXXXX...`

</details>

<br>

**Config locations:**
| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

→ [Get your API key](https://airtable.com/create/tokens)

<br>

## 🛠 Available Tools

<table>
<tr>
<th>Category</th>
<th>Tools</th>
</tr>
<tr>
<td><strong>Bases & Workspaces</strong></td>
<td><code>list_workspaces</code> · <code>list_bases</code> · <code>get_base_schema</code> · <code>create_base</code></td>
</tr>
<tr>
<td><strong>Tables</strong></td>
<td><code>list_tables</code> · <code>create_table</code> · <code>update_table</code></td>
</tr>
<tr>
<td><strong>Fields</strong></td>
<td><code>create_field</code> · <code>update_field</code> · <code>upload_attachment</code></td>
</tr>
<tr>
<td><strong>Records</strong></td>
<td><code>get_records</code> · <code>get_record</code> · <code>create_records</code> · <code>update_record</code> · <code>delete_record</code></td>
</tr>
<tr>
<td><strong>Batch Operations</strong></td>
<td><code>upsert_records</code> · <code>delete_records</code></td>
</tr>
<tr>
<td><strong>Comments</strong></td>
<td><code>list_comments</code> · <code>create_comment</code> · <code>update_comment</code> · <code>delete_comment</code></td>
</tr>
<tr>
<td><strong>Health</strong></td>
<td><code>health_check</code> · <code>liveness</code> · <code>readiness</code></td>
</tr>
</table>

<br>

## 💬 Usage Examples

```
"List all my Airtable bases"

"Get records from Tasks where Status = 'Active'"

"Create a new task with Name='Review PR' and Priority='High'"

"Upload the PDF to the Attachments field on record rec123"
```

<br>

## 🔐 Authentication

The server supports flexible authentication with clear priority:

| Priority | API Key Source | Workspace ID Source |
|:--------:|----------------|---------------------|
| 1 | `x-airtable-api-key` header | `x-airtable-workspace-id` header |
| 2 | `Authorization: Bearer` header | `workspaceId` parameter |
| 3 | `airtableApiKey` parameter | `AIRTABLE_WORKSPACE_ID` env |
| 4 | `AIRTABLE_API_KEY` env | — |

> **Note:** In production, use headers for multi-tenant support.

<br>

## 🛡 Stability & Resilience

<details>
<summary><strong>Retry with Exponential Backoff</strong></summary>

- Auto-retries on HTTP 429, 500, 502, 503, 504
- Handles network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED)
- Respects `Retry-After` headers
- Configurable: max retries, delays, jitter

</details>

<details>
<summary><strong>Circuit Breaker Pattern</strong></summary>

Prevents cascading failures with three states:
- **CLOSED** — Normal operation
- **OPEN** — Fast-fail mode (API degraded)
- **HALF_OPEN** — Testing recovery

</details>

<details>
<summary><strong>Request Management</strong></summary>

- **Timeout**: 30s default per request (AbortController)
- **Deduplication**: Shares results for identical concurrent GETs
- **Queue**: Limits to 5 concurrent requests
- **Keep-Alive**: Connection pooling via undici

</details>

<details>
<summary><strong>Health Checks</strong></summary>

Kubernetes-ready probes:
- `health_check` — Detailed status (memory, circuit breakers, uptime)
- `liveness` — Simple alive check
- `readiness` — Service ready to accept traffic

</details>

<br>

## 🐳 Deployment

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
docker run -p 3000:3000 mcp-airtable
```

### Environment Variables

<details>
<summary><strong>View all configuration options</strong></summary>

```bash
# Server
PORT=3000                              # Default: 3000
NODE_ENV=production

# Authentication (fallbacks — prefer headers)
AIRTABLE_API_KEY=
AIRTABLE_WORKSPACE_ID=

# Rate Limiting
RATE_LIMIT_ENABLED=true                # Default: true
RATE_LIMIT_REQUESTS_PER_MINUTE=60      # Default: 60

# Caching (seconds)
CACHE_ENABLED=true                     # Default: true
CACHE_TTL_BASES=300                    # Default: 300
CACHE_TTL_SCHEMA=600                   # Default: 600
CACHE_TTL_TABLES=300                   # Default: 300

# Logging
LOG_LEVEL=info                         # debug | info | warn | error

# Sentry (Optional)
SENTRY_DSN=
SENTRY_DEBUG=false
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

</details>

<br>

## 📁 Architecture

```
src/
├── index.ts                 # Entry point
├── server.ts                # FastMCP initialization
├── tools/                   # 21 tools across 6 files
│   ├── bases.ts
│   ├── tables.ts
│   ├── fields.ts
│   ├── records.ts
│   ├── batch.ts
│   └── comments.ts
└── lib/                     # Core utilities
    ├── airtable/            # Modular API client
    ├── auth.ts              # Authentication
    ├── validation.ts        # Input sanitization
    ├── errors.ts            # Error handling
    ├── retry.ts             # Exponential backoff
    ├── circuit-breaker.ts   # Failure prevention
    ├── health.ts            # K8s probes
    ├── deduplication.ts     # Request dedup
    ├── request-queue.ts     # Concurrency control
    └── ...
```

**Stats:** ~2,500 lines of production code · 272 unit tests · 25 e2e tests

<br>

## 📖 References

| Resource | Link |
|----------|------|
| MCP Specification | [modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-11-25) |
| FastMCP Framework | [github.com/punkpeye/fastmcp](https://github.com/punkpeye/fastmcp) |
| mcp-remote Bridge | [npmjs.com/package/mcp-remote](https://www.npmjs.com/package/mcp-remote) |
| Airtable API | [airtable.com/developers](https://airtable.com/developers/web/api/introduction) |

<br>

---

<div align="center">

**[Security Policy](./SECURITY.md)** · **[Examples](./examples/)** · **[Changelog](./CHANGELOG.md)**

MIT License © Delta & Beta

</div>
