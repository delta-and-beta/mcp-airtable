# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server integration for Airtable. The project enables AI assistants to interact with Airtable databases through the MCP protocol.

## Development Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- Airtable API key and base ID
- MCP SDK dependencies

### Common Commands

Once the project is initialized, typical commands will include:

```bash
# Install dependencies
npm install

# Build the MCP server
npm run build

# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Architecture

### Server Modes

This MCP server supports two transport modes:

1. **stdio mode** (`src/index.ts`) - For local Claude Desktop integration
   - Direct process communication via standard I/O
   - Used when Claude Desktop spawns the server as a subprocess
   - Default mode for local development

2. **SSE mode** (`src/server-sse-production.ts`) - For remote deployments
   - HTTP server with Server-Sent Events transport
   - Used for cloud deployments (Zeabur, Railway, etc.)
   - Supports authentication and CORS
   - Provides `/health` and `/mcp` endpoints

### Expected Structure

```
mcp-airtable/
├── src/
│   ├── index.ts                    # stdio server entry point (local)
│   ├── server-sse-production.ts    # SSE server entry point (remote)
│   ├── handlers/                   # MCP protocol handlers
│   │   ├── tools.ts               # Tool definitions (CRUD operations)
│   │   └── tools-refactored.ts    # Refactored handlers for SSE mode
│   ├── airtable/                  # Airtable API integration
│   │   ├── client.ts              # Airtable client wrapper
│   │   ├── queued-client.ts       # Rate-limited batch operations
│   │   └── types.ts               # TypeScript types for Airtable data
│   ├── s3/                        # S3 storage integration
│   ├── gcs/                       # Google Cloud Storage integration
│   └── utils/                     # Utility functions
├── deploy/                        # Deployment configurations
│   ├── zeabur/                    # Zeabur-specific (uses SSE mode)
│   ├── railway/                   # Railway-specific (uses SSE mode)
│   └── claude-desktop/            # Local Claude Desktop (uses stdio mode)
├── package.json
├── tsconfig.json
├── .env.example                   # Environment variables template
└── README.md
```

### Key Components

1. **MCP Server**: Implements the Model Context Protocol to expose Airtable operations as tools
2. **Airtable Client**: Wraps the Airtable API for database operations
3. **Tool Handlers**: Define available operations (create, read, update, delete records)
4. **Resource Providers**: Expose Airtable schemas and data as MCP resources

## MCP Integration Points

### Tools to Implement
- `list_bases` - List available Airtable bases
- `list_tables` - List tables in a base
- `get_records` - Retrieve records with filtering
- `create_record` - Create new records
- `update_record` - Update existing records
- `delete_record` - Delete records
- `get_schema` - Get table schema information

### Resources to Expose
- Table schemas
- Field configurations
- View definitions

## Environment Configuration

The project will need these environment variables:
- `AIRTABLE_API_KEY` - Personal access token or API key
- `AIRTABLE_BASE_ID` - Default base ID (optional)

## Testing Approach

- Unit tests for Airtable client methods
- Integration tests for MCP handlers
- Mock Airtable API responses for reliable testing

## Important Considerations

1. **Rate Limiting**: Airtable API has rate limits (5 requests/second per base)
2. **Error Handling**: Properly handle Airtable API errors and network issues
3. **Type Safety**: Use TypeScript for strong typing of Airtable records
4. **Security**: Never expose API keys in logs or error messages

## Deployment Workflow

### Branch Strategy

This project follows Git Flow with configuration-driven deployments:

```
main                    # Production-ready code (stable releases only)
├── develop             # Integration branch (all development happens here)
├── feature/*           # Feature branches (branch from develop)
├── hotfix/*           # Emergency fixes (branch from main)
├── deploy/zeabur       # Zeabur deployment configuration
├── deploy/docker       # Generic Docker deployment
├── deploy/claude-desktop # Local Claude Desktop configuration
├── deploy/remote-sse   # Remote SSE server deployment
└── deploy/railway      # Railway deployment configuration
```

### Development Workflow

1. **All development work flows through `develop` branch**
   ```bash
   # Start a new feature
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   
   # Make changes and commit
   git add .
   git commit -m "feat: your feature description"
   
   # Push and create PR to develop
   git push -u origin feature/your-feature-name
   # Create PR: feature/your-feature-name → develop
   ```

2. **Merging to main (releases only)**
   ```bash
   # When develop is ready for release
   git checkout main
   git merge develop --no-ff -m "Release: v1.0.0"
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin main --tags
   ```

3. **Syncing Deployment Branches**
   ```bash
   # Automatic: GitHub Actions syncs on push to main
   # Manual: Use the sync script from main branch
   git checkout main
   ./deploy/scripts/sync-branches.sh
   ```

4. **Creating New Deployment Target**
   ```bash
   git checkout develop
   ./deploy/scripts/setup-deployment.sh <platform-name>
   ```

5. **Hotfix Workflow**
   ```bash
   # For urgent production fixes
   git checkout main
   git checkout -b hotfix/fix-description
   # Make fixes
   git push -u origin hotfix/fix-description
   # Create PR: hotfix/fix-description → main
   # After merge, also merge back to develop
   git checkout develop
   git merge main
   ```

### Deployment Configuration

Each deployment branch contains platform-specific files in `/deploy/<platform>/`:
- `config.json` - Runtime configuration (git-ignored)
- `config.example.json` - Example configuration template
- `Dockerfile` - Platform-specific Docker configuration (if needed)
- `README.md` - Platform-specific documentation
- Platform files (e.g., `zeabur.json`, `railway.json`, `fly.toml`)

### Testing Deployments

Before deploying:
1. Ensure all tests pass on `main`: `npm test`
2. Build the project: `npm run build`
3. Test locally with deployment config:
   ```bash
   DEPLOYMENT_NAME=zeabur npm start
   ```

### Deployment Commands

```bash
# Deploy to specific platform
git checkout deploy/<platform>
cd deploy/<platform>
./deploy.sh

# Or use platform-specific commands
zeabur deploy      # For Zeabur (uses SSE mode)
railway up         # For Railway (uses SSE mode)
docker compose up  # For Docker (configurable)
```

### Mode Selection by Deployment

- **Local/Claude Desktop**: Uses stdio mode (`index.ts`)
- **Zeabur**: Uses SSE mode (`server-sse-production.ts`) 
- **Railway**: Uses SSE mode (`server-sse-production.ts`)
- **Docker**: Configurable via CMD in Dockerfile
- **Generic Remote**: Typically uses SSE mode for HTTP access

### Important Notes

- **DO NOT** merge deployment branches back into main or develop
- **DO NOT** cherry-pick commits between deployment branches
- **NEVER** commit directly to main (except hotfixes)
- **ALWAYS** work on feature branches from develop
- **ALL** code changes must go through develop branch first
- Deployment branches sync automatically from main (production) only
- Deployment-specific files in `/deploy/` directories are preserved during syncs
- Use `DEPLOYMENT_NAME` environment variable to load platform-specific configs at runtime

### Branch Protection Rules

Configure these branch protection rules in GitHub:

1. **main branch**:
   - Require pull request reviews (at least 1)
   - Require status checks to pass (tests, build)
   - Require branches to be up to date
   - Include administrators in restrictions

2. **develop branch**:
   - Require pull request reviews
   - Require status checks to pass
   - Allow force pushes by maintainers only

3. **deploy/* branches**:
   - Restrict direct pushes (only allow sync workflow)