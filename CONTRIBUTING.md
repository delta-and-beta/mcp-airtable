# Contributing to MCP Airtable

Thank you for your interest in contributing to MCP Airtable! This guide explains our development workflow and standards.

## Development Workflow

We follow Git Flow with the following branches:

- `main` - Production-ready code (protected)
- `develop` - Integration branch for features
- `feature/*` - Feature development
- `hotfix/*` - Emergency production fixes
- `deploy/*` - Platform-specific deployment configs (auto-synced)

### Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file from `.env.example`
4. Run tests: `npm test`

### Making Changes

#### For New Features

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and test
npm test
npm run lint
npm run type-check

# 4. Commit using conventional commits
git add .
git commit -m "feat: add new feature"
# or
git commit -m "fix: resolve issue"
# or  
git commit -m "docs: update readme"

# 5. Push and create PR
git push -u origin feature/your-feature-name
# Create PR: feature/your-feature-name → develop
```

#### For Hotfixes

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create hotfix branch
git checkout -b hotfix/fix-description

# 3. Make minimal fix and test
npm test

# 4. Push and create PR
git push -u origin hotfix/fix-description
# Create PR: hotfix/fix-description → main

# 5. After merge, backport to develop
git checkout develop
git merge main
```

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, semicolons, etc)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test additions or corrections
- `build:` Build system changes
- `ci:` CI configuration changes
- `chore:` Other changes that don't modify src or test files

### Code Standards

1. **TypeScript**: Use strict mode, avoid `any`
2. **Testing**: Maintain >80% coverage for new code
3. **Linting**: Run `npm run lint` before committing
4. **Security**: Never commit secrets or API keys

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- client.test.ts
```

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add tests for new functionality
4. Request review from maintainers
5. Address review feedback
6. Squash commits if requested

### Deployment Branches

**DO NOT** modify deployment branches directly. They are automatically synced from `main`.

To add deployment configurations:
1. Make changes in `develop`
2. Add files to `/deploy/<platform>/`
3. Changes will sync after release to `main`

### Release Process

1. Ensure `develop` is stable
2. Create release PR: `develop → main`
3. Update version in `package.json`
4. Update CHANGELOG.md
5. After merge, tag the release
6. Deployment branches auto-sync

## Questions?

- Open an issue for bugs
- Start a discussion for features
- Join our Discord for chat

Thank you for contributing!