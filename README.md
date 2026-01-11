<div align="center">

<br>

# MCP Airtable

<br>

**Production-ready MCP server for Airtable integration**

<br>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-297_passing-00D9C0?style=flat-square)](./src/__tests__)
[![License](https://img.shields.io/badge/License-MIT-FF6B5B?style=flat-square)](./LICENSE)

<br>

*Built with [FastMCP](https://github.com/punkpeye/fastmcp) — Works with Claude Desktop & Claude.ai*

<br>

---

<br>

</div>

## Overview

A minimal, enterprise-grade MCP server enabling AI assistants to interact with Airtable. Features **21 tools** covering complete CRUD operations, batch processing, schema management, and file attachments—built with meticulous precision and strategic clarity.

<br>

## Δ Capabilities

<table>
<tr>
<td width="50%" valign="top">

### Core

**21 Tools** — Full CRUD, batch operations, attachments
**Streamable HTTP** — Claude Desktop 2025+ native support
**Header Auth** — Multi-tenant ready architecture

</td>
<td width="50%" valign="top">

### Reliability

**Circuit Breaker** — Cascading failure prevention
**Auto-Retry** — Exponential backoff with jitter
**Health Checks** — K8s liveness & readiness probes

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Security

**Input Validation** — Zod schemas everywhere
**Injection Prevention** — Formula & path attacks blocked
**Audit Ready** — Full security documentation

</td>
<td width="50%" valign="top">

### Performance

**Connection Pooling** — Keep-alive via undici
**Request Deduplication** — Shares concurrent results
**Response Caching** — 5-10min TTL for metadata

</td>
</tr>
</table>

<br>

## Quick Start

```bash
npm install && npm run build
npm start
```

Server runs at `http://localhost:3000/mcp`

<br>

## Configuration

<details>
<summary><b>Local Development (stdio)</b></summary>
<br>

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
<summary><b>Remote HTTP (mcp-remote)</b></summary>
<br>

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
<summary><b>Claude.ai Web</b></summary>
<br>

1. Deploy: `npm start`
2. Claude.ai → Settings → Connectors
3. Add URL: `https://your-server.com/mcp`
4. Add header: `x-airtable-api-key: patXXXXX...`

</details>

<br>

| Platform | Config Path |
|:---------|:------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

→ [Get your API key](https://airtable.com/create/tokens)

<br>

## β Tools

| Category | Tools |
|:---------|:------|
| **Bases & Workspaces** | `list_workspaces` · `list_bases` · `get_base_schema` · `create_base` |
| **Tables** | `list_tables` · `create_table` · `update_table` |
| **Fields** | `create_field` · `update_field` · `upload_attachment` |
| **Records** | `get_records` · `get_record` · `create_records` · `update_record` · `delete_record` |
| **Batch** | `upsert_records` · `delete_records` |
| **Comments** | `list_comments` · `create_comment` · `update_comment` · `delete_comment` |
| **Health** | `health_check` · `liveness` · `readiness` |

<br>

## Usage

```
"List all my Airtable bases"

"Get records from Tasks where Status = 'Active'"

"Create a task with Name='Review PR' and Priority='High'"

"Upload the PDF to the Attachments field on record rec123"
```

<br>

## Authentication

| Priority | API Key | Workspace ID |
|:--------:|:--------|:-------------|
| 1 | `x-airtable-api-key` header | `x-airtable-workspace-id` header |
| 2 | `Authorization: Bearer` header | `workspaceId` parameter |
| 3 | `airtableApiKey` parameter | `AIRTABLE_WORKSPACE_ID` env |
| 4 | `AIRTABLE_API_KEY` env | — |

<br>

## Stability & Resilience

<details>
<summary><b>Retry with Exponential Backoff</b></summary>
<br>

- Auto-retries on HTTP 429, 500, 502, 503, 504
- Handles network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED)
- Respects `Retry-After` headers
- Configurable max retries, delays, jitter

</details>

<details>
<summary><b>Circuit Breaker Pattern</b></summary>
<br>

Prevents cascading failures:
- **CLOSED** — Normal operation
- **OPEN** — Fast-fail mode
- **HALF_OPEN** — Recovery testing

</details>

<details>
<summary><b>Request Management</b></summary>
<br>

- **Timeout**: 30s default (AbortController)
- **Deduplication**: Shares identical concurrent GETs
- **Queue**: Limits to 5 concurrent requests
- **Keep-Alive**: Connection pooling via undici

</details>

<details>
<summary><b>Health Checks</b></summary>
<br>

Kubernetes-ready probes:
- `health_check` — Full status report
- `liveness` — Alive check
- `readiness` — Traffic ready

</details>

<br>

## Deployment

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

<details>
<summary><b>Environment Variables</b></summary>
<br>

```bash
# Server
PORT=3000
NODE_ENV=production

# Auth (prefer headers in production)
AIRTABLE_API_KEY=
AIRTABLE_WORKSPACE_ID=

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Caching
CACHE_ENABLED=true
CACHE_TTL_BASES=300
CACHE_TTL_SCHEMA=600
CACHE_TTL_TABLES=300

# Logging
LOG_LEVEL=info

# Sentry (Optional)
SENTRY_DSN=
SENTRY_DEBUG=false
SENTRY_ENVIRONMENT=production
```

</details>

<br>

## Architecture

```
src/
├── index.ts                 # Entry point
├── server.ts                # FastMCP init
├── tools/                   # 21 tools
│   ├── bases.ts
│   ├── tables.ts
│   ├── fields.ts
│   ├── records.ts
│   ├── batch.ts
│   └── comments.ts
└── lib/                     # Core
    ├── airtable/            # API client
    ├── retry.ts             # Backoff
    ├── circuit-breaker.ts   # Failure prevention
    ├── health.ts            # K8s probes
    ├── deduplication.ts     # Request dedup
    └── ...
```

**~2,500 lines** · **272 unit tests** · **25 e2e tests**

<br>

## References

| | |
|:--|:--|
| MCP Specification | [modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-11-25) |
| FastMCP | [github.com/punkpeye/fastmcp](https://github.com/punkpeye/fastmcp) |
| mcp-remote | [npmjs.com/package/mcp-remote](https://www.npmjs.com/package/mcp-remote) |
| Airtable API | [airtable.com/developers](https://airtable.com/developers/web/api/introduction) |

<br>

---

<div align="center">

<br>

**[Security](./SECURITY.md)** · **[Examples](./examples/)** · **[Changelog](./CHANGELOG.md)**

<br>

MIT License

<br>

**DELTΔ & βETΑ**

*From Change to What's Next*

<br>

</div>
