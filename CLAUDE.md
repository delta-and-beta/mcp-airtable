# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server for Airtable integration. The project enables AI assistants to interact with Airtable databases through a standardized protocol.

## Architecture

### Clean Architecture Principles

The codebase follows clean architecture with clear separation of concerns:

```
src/
├── index.ts          # STDIO transport (Claude Desktop)
├── server.ts         # HTTP transport (Remote deployments)
├── config/           # Configuration management
│   ├── index.ts      # Config loader and helpers
│   └── schema.ts     # Zod validation schemas
├── tools/            # Tool layer
│   ├── index.ts      # Tool registry
│   └── definitions.ts # Tool interface definitions
├── handlers/         # Business logic
│   ├── tools.ts      # Original handlers (to be refactored)
│   └── tools-refactored.ts # Clean implementation
├── services/         # External services
│   ├── airtable/     # Airtable API client
│   └── storage/      # S3/GCS clients
└── utils/            # Shared utilities
```

### Key Design Decisions

1. **Transport Separation**: STDIO for local use, HTTP for remote deployments
2. **Clean Imports**: Tools module provides a single import point
3. **Configuration**: Validated with Zod, lazy-loaded singleton pattern
4. **Error Handling**: Consistent error types and formatting
5. **No Framework Lock-in**: Generic MCP implementation, not tied to specific clients

## Development Guidelines

### Code Style

- Use TypeScript with strict mode
- Prefer functional programming patterns
- Keep functions small and focused
- Use descriptive variable names
- Add JSDoc comments for public APIs

### Testing

- Write unit tests for all business logic
- Mock external services (Airtable, S3, GCS)
- Use integration tests for API endpoints
- Maintain >80% code coverage

### Security

- Never log sensitive information (API keys, tokens)
- Validate all inputs with Zod schemas
- Use environment variables for configuration
- Implement rate limiting for production
- Follow principle of least privilege for access control
- Authentication is mandatory in production

## Common Commands

```bash
# Development
npm run dev          # STDIO mode with hot reload
npm run dev:server   # HTTP mode with hot reload

# Building
npm run build        # Compile TypeScript
npm run type-check   # Type checking only

# Testing
npm test            # Run tests
npm run test:coverage # With coverage report

# Production
npm start           # Run STDIO server
npm run start:server # Run HTTP server
```

## Important Patterns

### Adding a New Tool

1. Add tool definition to `src/tools/definitions.ts`
2. Implement handler in `src/handlers/tools-refactored.ts`
3. Add validation schema if needed
4. Write tests for the new tool
5. Update documentation

### Configuration Changes

1. Add to schema in `src/config/schema.ts`
2. Update type definitions
3. Add validation rules
4. Document in README.md

### Error Handling

Always use the error utilities:

```typescript
import { formatErrorResponse, AirtableError } from './utils/errors.js';

// In handlers
try {
  // operation
} catch (error) {
  if (error instanceof AirtableError) {
    // Handle known errors
  }
  throw formatErrorResponse(error);
}
```

## Git Workflow

1. All development happens on `develop` branch
2. Create feature branches from `develop`
3. Merge to `develop` via PR
4. Release by merging `develop` to `main`
5. Tag releases on `main` branch

## Deployment

- Local: Use `npm start` for Claude Desktop
- Docker: Build with provided Dockerfile
- Cloud: Use `npm run start:server` with proper environment variables

## Things to Avoid

1. **No Hardcoded Values**: Use environment variables
2. **No Direct Console Logs**: Use the logger utility
3. **No Synchronous File Operations**: Use async/await
4. **No Unauthenticated Production Access**: Always require MCP_AUTH_TOKEN
5. **No Sensitive Data in Errors**: Sanitize error messages

## Debugging Tips

- Set `LOG_LEVEL=debug` for verbose logging
- Use `NODE_ENV=development` for detailed errors
- Check `/health` endpoint for service status
- Monitor rate limit headers in responses

## Performance Considerations

- Batch operations when possible
- Use connection pooling for Redis
- Implement caching for frequently accessed data
- Monitor Airtable API rate limits
- Use queued client for bulk operations

## Security Checklist

- [ ] MCP_AUTH_TOKEN is required in production
- [ ] All inputs are validated with Zod
- [ ] No secrets in logs or error messages
- [ ] Access control lists are configured
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] Dependencies are up to date