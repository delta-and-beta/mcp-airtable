#!/bin/bash

# Script to set up a new deployment configuration

set -e

# Check if deployment name provided
if [ -z "$1" ]; then
  echo "Usage: ./setup-deployment.sh <deployment-name>"
  echo "Example: ./setup-deployment.sh zeabur"
  exit 1
fi

DEPLOYMENT_NAME=$1
DEPLOY_DIR="deploy/$DEPLOYMENT_NAME"

echo "Setting up deployment configuration for: $DEPLOYMENT_NAME"

# Create deployment directory structure
mkdir -p "$DEPLOY_DIR"

# Create deployment-specific README
cat > "$DEPLOY_DIR/README.md" << EOF
# $DEPLOYMENT_NAME Deployment

## Overview

This directory contains $DEPLOYMENT_NAME-specific deployment configurations.

## Configuration Files

- \`config.json\` - Runtime configuration (git-ignored)
- \`config.example.json\` - Example configuration
- \`deploy.sh\` - Deployment script

## Setup

1. Copy \`config.example.json\` to \`config.json\`
2. Update configuration values
3. Run \`./deploy.sh\`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| AIRTABLE_API_KEY | Airtable API key | Yes |
| MCP_AUTH_TOKEN | Authentication token | Yes (production) |

## Deployment

\`\`\`bash
cd deploy/$DEPLOYMENT_NAME
./deploy.sh
\`\`\`
EOF

# Create example config
cat > "$DEPLOY_DIR/config.example.json" << EOF
{
  "deployment": {
    "name": "$DEPLOYMENT_NAME",
    "type": "container|serverless|edge",
    "region": "us-east-1"
  },
  "environment": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "info"
  },
  "features": {
    "redis": false,
    "s3": false,
    "gcs": false
  }
}
EOF

# Create deployment script
cat > "$DEPLOY_DIR/deploy.sh" << 'EOF'
#!/bin/bash

set -e

echo "Deploying to $DEPLOYMENT_NAME..."

# Load configuration
if [ ! -f "config.json" ]; then
  echo "Error: config.json not found. Copy config.example.json and update values."
  exit 1
fi

# Build the project
echo "Building project..."
cd ../..
npm run build

# Platform-specific deployment commands
case "$DEPLOYMENT_NAME" in
  "zeabur")
    echo "Deploying to Zeabur..."
    zeabur deploy
    ;;
  "docker")
    echo "Building Docker image..."
    docker build -t mcp-airtable .
    ;;
  "railway")
    echo "Deploying to Railway..."
    railway up
    ;;
  *)
    echo "Custom deployment for $DEPLOYMENT_NAME"
    ;;
esac

echo "Deployment complete!"
EOF

# Make deploy script executable
chmod +x "$DEPLOY_DIR/deploy.sh"

# Create .gitkeep for empty directories
touch "$DEPLOY_DIR/.gitkeep"

echo "✓ Deployment configuration created at: $DEPLOY_DIR"
echo ""
echo "Next steps:"
echo "1. cd $DEPLOY_DIR"
echo "2. Edit config.example.json with your specific settings"
echo "3. Copy to config.json and add actual values"
echo "4. Run ./deploy.sh to deploy"