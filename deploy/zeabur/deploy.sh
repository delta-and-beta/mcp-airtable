#!/bin/bash

# Zeabur deployment script

set -e

echo "🚀 Deploying MCP Airtable to Zeabur..."

# Check if on deploy/zeabur branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "deploy/zeabur" ]; then
  echo "⚠️  Not on deploy/zeabur branch. Switch to it first:"
  echo "   git checkout deploy/zeabur"
  exit 1
fi

# Ensure latest changes from main
echo "📥 Syncing with main branch..."
git fetch origin main
git merge origin/main --no-edit || echo "⚠️  Merge conflicts may need resolution"

# Check for Zeabur CLI
if ! command -v zeabur &> /dev/null; then
  echo "❌ Zeabur CLI not found. Install it with:"
  echo "   npm install -g @zeabur/cli"
  exit 1
fi

# Deploy
echo "🔨 Building and deploying..."
zeabur deploy

echo "✅ Deployment initiated!"
echo ""
echo "Next steps:"
echo "1. Check deployment status in Zeabur dashboard"
echo "2. Set environment variables if not already done"
echo "3. Test with: curl https://your-service.zeabur.app/health"