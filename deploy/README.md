# Deployment Configuration Strategy

## Overview

This project uses a configuration-driven approach to maintain a single codebase across multiple deployment targets. All deployment-specific configurations are isolated in the `/deploy` directory.

## Server Transport Modes

The MCP server supports two transport modes:

1. **stdio mode** - Used for local Claude Desktop integration
   - Direct process communication
   - Run with: `npm start` or `node dist/index.js`

2. **SSE mode** - Used for remote deployments (Zeabur, Railway, etc.)
   - HTTP server with Server-Sent Events
   - Run with: `npm run start:sse` or `node dist/server-sse-production.js`
   - Provides endpoints: `/health` and `/mcp`

## Structure

```
deploy/
├── base/                 # Shared configuration files
│   ├── Dockerfile.base   # Base Dockerfile
│   └── docker-compose.base.yml
├── zeabur/              # Zeabur-specific configs (SSE mode)
│   ├── zeabur.json
│   ├── Dockerfile       # CMD: server-sse-production.js
│   └── README.md
├── docker/              # Generic Docker configs
│   ├── Dockerfile
│   └── docker-compose.yml
├── claude-desktop/      # Claude Desktop configs (stdio mode)
│   ├── config.example.json
│   └── README.md
├── railway/             # Railway configs (SSE mode)
│   ├── railway.json
│   └── README.md
├── n8n/                 # n8n workflow bridge (SSE to stdio)
│   └── README.md
└── scripts/             # Deployment scripts
    ├── sync-branches.sh
    └── deploy.sh
```

## Deployment Mode Selection

| Platform | Transport Mode | Entry Point |
|----------|----------------|-------------|
| Claude Desktop (local) | stdio | `dist/index.js` |
| Zeabur | SSE | `dist/server-sse-production.js` |
| Railway | SSE | `dist/server-sse-production.js` |
| Docker | Configurable | Depends on Dockerfile CMD |
| n8n Bridge | SSE → stdio | Proxy between modes |

## Maintenance Workflow

1. All code changes go to `develop` branch first, then merge to `main`
2. Deployment branches only contain `/deploy` directory differences
3. Use automated scripts to sync code changes from `main` to deployment branches
4. Environment-specific configs stay in their respective directories

## Quick Start

```bash
# Sync main branch changes to all deployment branches
./deploy/scripts/sync-branches.sh

# Deploy to specific platform
./deploy/scripts/deploy.sh zeabur
```