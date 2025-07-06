# Deployment Configuration Strategy

## Overview

This project uses a configuration-driven approach to maintain a single codebase across multiple deployment targets. All deployment-specific configurations are isolated in the `/deploy` directory.

## Structure

```
deploy/
├── base/                 # Shared configuration files
│   ├── Dockerfile.base   # Base Dockerfile
│   └── docker-compose.base.yml
├── zeabur/              # Zeabur-specific configs
│   ├── zeabur.json
│   └── README.md
├── docker/              # Generic Docker configs
│   ├── Dockerfile
│   └── docker-compose.yml
├── claude-desktop/      # Claude Desktop configs
│   ├── config.example.json
│   └── README.md
├── railway/             # Railway configs
│   ├── railway.json
│   └── README.md
└── scripts/             # Deployment scripts
    ├── sync-branches.sh
    └── deploy.sh
```

## Maintenance Workflow

1. All code changes go to `main` branch
2. Deployment branches only contain `/deploy` directory differences
3. Use automated scripts to sync code changes
4. Environment-specific configs stay in their respective directories

## Quick Start

```bash
# Sync main branch changes to all deployment branches
./deploy/scripts/sync-branches.sh

# Deploy to specific platform
./deploy/scripts/deploy.sh zeabur
```