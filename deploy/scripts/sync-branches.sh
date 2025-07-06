#!/bin/bash

# Script to sync main branch changes to all deployment branches
# while preserving deployment-specific configurations

set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Deployment branches to sync
DEPLOY_BRANCHES=(
  "deploy/zeabur"
  "deploy/docker"
  "deploy/claude-desktop"
  "deploy/remote-sse"
  "deploy/railway"
  "deploy/high-volume"
  "deploy/minimal"
)

# Files/directories to preserve in deployment branches
PRESERVE_PATHS=(
  "deploy/"
  "zeabur.json"
  "railway.json"
  "render.yaml"
  "fly.toml"
  "heroku.yml"
  ".platform/"
  "vercel.json"
  "netlify.toml"
)

echo -e "${GREEN}Starting branch synchronization...${NC}"

# Ensure we're on main branch (deployment branches sync from main/production only)
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
  echo -e "${YELLOW}Switching to main branch...${NC}"
  echo -e "${YELLOW}Note: Deployment branches sync from main (production) only${NC}"
  git checkout main
fi

# Pull latest changes
echo -e "${GREEN}Pulling latest changes from main...${NC}"
git pull origin main

# Function to check if branch exists
branch_exists() {
  git show-ref --verify --quiet refs/heads/"$1"
}

# Function to sync a deployment branch
sync_branch() {
  local branch=$1
  echo -e "\n${GREEN}Syncing ${branch}...${NC}"
  
  # Check if branch exists
  if ! branch_exists "$branch"; then
    echo -e "${YELLOW}Branch $branch doesn't exist. Creating...${NC}"
    git checkout -b "$branch"
    git push -u origin "$branch"
    git checkout main
    return
  fi
  
  # Checkout deployment branch
  git checkout "$branch"
  
  # Stash deployment-specific files
  echo "Preserving deployment-specific files..."
  git stash push -m "deployment-configs" -- "${PRESERVE_PATHS[@]}" 2>/dev/null || true
  
  # Merge main branch changes
  echo "Merging changes from main..."
  if git merge main --no-edit; then
    echo -e "${GREEN}✓ Merged successfully${NC}"
  else
    echo -e "${RED}✗ Merge conflicts detected${NC}"
    echo "Please resolve conflicts manually, then run:"
    echo "  git add ."
    echo "  git commit"
    echo "  git stash pop"
    return 1
  fi
  
  # Restore deployment-specific files
  if git stash list | grep -q "deployment-configs"; then
    echo "Restoring deployment-specific files..."
    git stash pop --quiet || true
  fi
  
  # Push changes
  echo "Pushing changes..."
  git push origin "$branch"
  
  echo -e "${GREEN}✓ Branch $branch synchronized${NC}"
}

# Sync all deployment branches
for branch in "${DEPLOY_BRANCHES[@]}"; do
  sync_branch "$branch" || echo -e "${RED}Failed to sync $branch${NC}"
done

# Return to main branch
echo -e "\n${GREEN}Returning to main branch...${NC}"
git checkout main

echo -e "\n${GREEN}Synchronization complete!${NC}"
echo -e "${YELLOW}Remember to test each deployment configuration after syncing.${NC}"