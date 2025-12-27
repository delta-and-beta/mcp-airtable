# MCP Server Implementation Agent Instructions

## Overview
This document provides comprehensive instructions for creating a production-ready MCP (Model Context Protocol) server implementation. Follow these detailed steps to build a robust, secure, and well-documented MCP server for any service integration.

## Prerequisites
- Node.js 20+ and TypeScript knowledge
- Understanding of the service API you're integrating (e.g., Airtable, Notion, GitHub)
- Familiarity with MCP protocol basics
- Git and GitHub account for version control

## Phase 1: Project Setup and Architecture

### 1.1 Initialize Project Structure
```bash
mkdir mcp-[service-name]
cd mcp-[service-name]
npm init -y
git init
```

### 1.2 Create Clean Architecture
```
src/
├── index.ts          # STDIO transport entry point
├── server.ts         # HTTP transport entry point
├── config/           # Configuration management
│   ├── index.ts      # Config loader with validation
│   └── schema.ts     # Zod schemas for validation
├── tools/            # MCP tool definitions
│   ├── index.ts      # Tool registry and exports
│   └── definitions.ts # Tool interface definitions
├── handlers/         # Business logic layer
│   └── tools.ts      # Tool implementations
├── services/         # External service integrations
│   └── [service]/    # Service-specific client
│       ├── client.ts # API client implementation
│       └── types.ts  # TypeScript types
└── utils/            # Shared utilities
    ├── errors.ts     # Error types and formatting
    ├── logger.ts     # Logging utilities
    ├── validation.ts # Input validation
    └── sanitization.ts # Output sanitization
```

### 1.3 Install Core Dependencies
```bash
npm install @modelcontextprotocol/sdk express cors dotenv zod
npm install -D @types/node @types/express typescript ts-node jest @types/jest
```

### 1.4 Configure TypeScript
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

## Phase 2: Core Implementation

### 2.1 Implement Configuration System
Create a robust configuration system with:
- Environment variable support
- Runtime validation using Zod
- Default values with overrides
- Secrets masking in logs

Key configuration areas:
- Service authentication (API keys, OAuth)
- Server settings (port, environment)
- Rate limiting configuration
- Access control settings
- Storage configuration (if needed)

### 2.2 Create MCP Server Entry Points

#### STDIO Transport (index.ts)
- Use `StdioServerTransport` from MCP SDK
- Handle process signals for graceful shutdown
- Ensure proper stdout/stderr separation

#### HTTP Transport (server.ts)
- Implement Express server with security middleware
- Add CORS, helmet, and rate limiting
- Create `/mcp` endpoint for MCP protocol
- Add `/health` endpoint for monitoring
- Implement authentication middleware

### 2.3 Define Tools
Follow these principles:
- Use intent-based naming (what, not how)
- Keep tools focused on single responsibilities
- Provide comprehensive descriptions
- Define clear parameter schemas
- Limit to <20 tools for usability

Example tool structure:
```typescript
{
  name: 'get_records',
  description: 'Retrieve records from a table with filtering and sorting',
  inputSchema: {
    type: 'object',
    properties: {
      tableName: { type: 'string', description: 'Name of the table' },
      filters: { type: 'object', description: 'Filter criteria' },
      maxRecords: { type: 'number', description: 'Maximum records to return' }
    },
    required: ['tableName']
  }
}
```

### 2.4 Implement Business Logic
- Create handler functions for each tool
- Implement proper error handling with try-catch
- Add input validation before processing
- Sanitize outputs before returning
- Use service clients for external API calls

### 2.5 Create Service Client
Build a robust client for the external service:
- Implement all necessary API methods
- Add automatic retry with exponential backoff
- Handle rate limiting gracefully
- Parse and wrap API errors consistently
- Support authentication methods (API key, OAuth)
- Implement request/response logging

## Phase 3: Security Implementation

### 3.1 Authentication
- Implement bearer token authentication for MCP server
- Support per-request API credentials via headers
- Never log sensitive information
- Use environment variables for secrets
- Consider OAuth 2.0 with PKCE for production

### 3.2 Input Validation
- Validate all inputs using Zod schemas
- Prevent SQL/NoSQL injection
- Implement path traversal protection
- Set payload size limits
- Sanitize file uploads

### 3.3 Access Control
- Implement allowlist/blocklist modes
- Support granular permissions
- Log access control decisions
- Provide clear error messages

### 3.4 Request Context
Create a request context system to extract:
- Authentication credentials from headers
- Service-specific options (e.g., `x-service-option-*`)
- Default configurations

Example headers to support:
```
x-[service]-api-key: API key for the service
x-[service]-option-[setting]: Service-specific settings
```

## Phase 4: Reliability Features

### 4.1 Error Handling
- Create custom error classes for different scenarios
- Implement consistent error formatting
- Map errors to appropriate status codes
- Never expose internal details in errors
- Add correlation IDs for tracing

### 4.2 Rate Limiting
- Implement rate limiting for API protection
- Use Redis for distributed rate limiting
- Provide in-memory fallback
- Return rate limit headers
- Respect service API rate limits

### 4.3 Retry Logic
- Implement exponential backoff with jitter
- Parse retry-after headers
- Distinguish retryable vs non-retryable errors
- Set maximum retry limits
- Log retry attempts

### 4.4 Queue Management (if needed)
- Use Bull queue for async operations
- Implement automatic batching
- Add priority queuing
- Handle job failures gracefully

## Phase 5: Performance Optimization

### 5.1 Response Optimization
- Implement field filtering
- Add pagination support
- Set default limits to prevent OOM
- Consider response streaming for large data

### 5.2 Connection Management
- Reuse HTTP connections with keep-alive
- Implement connection pooling
- Cache service clients by credentials
- Clean up resources on shutdown

### 5.3 Caching Strategy (optional)
- Add Redis caching for read operations
- Implement cache invalidation
- Set appropriate TTLs
- Monitor cache hit rates

## Phase 6: Testing

### 6.1 Unit Tests
- Test each handler function
- Mock external service calls
- Test error scenarios
- Validate schema enforcement
- Aim for >80% coverage

### 6.2 Integration Tests
- Test actual API connections (with test account)
- Verify authentication flows
- Test rate limiting behavior
- Validate error handling

### 6.3 MCP Protocol Tests
- Test with MCP Inspector
- Verify protocol compliance
- Test all tool definitions
- Validate error responses

## Phase 7: Documentation

### 7.1 README.md
Include:
- Clear project description
- Feature list
- Installation instructions
- Configuration guide
- Usage examples for each tool
- Security considerations
- Deployment options

### 7.2 API Documentation
- Document all tools with examples
- List all configuration options
- Explain authentication methods
- Provide troubleshooting guide

### 7.3 Code Documentation
- Add JSDoc comments to public APIs
- Document complex algorithms
- Explain design decisions
- Include usage examples

## Phase 8: Operational Readiness

### 8.1 Logging
- Implement structured logging
- Use appropriate log levels
- Add request IDs for tracing
- Mask sensitive data
- Configure log rotation

### 8.2 Monitoring
- Add health check endpoint
- Implement metrics collection
- Track error rates
- Monitor performance
- Set up alerts

### 8.3 Deployment
- Create optimized Dockerfile
- Add docker-compose for development
- Document environment variables
- Implement graceful shutdown
- Set resource limits

## Phase 9: Git Workflow

### 9.1 Branch Strategy
- Use Git Flow: main, develop, feature branches
- Always work on develop branch
- Merge to main only for releases
- Tag releases on main branch

### 9.2 Commit Messages
Follow conventional commits:
```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: improve code structure
test: add tests
chore: update dependencies
```

### 9.3 Pull Request Process
- Create feature branches from develop
- Write descriptive PR descriptions
- Ensure all tests pass
- Update documentation
- Merge via PR with review

## Phase 10: Continuous Improvement

### 10.1 Regular Audits
Run comprehensive audits covering:
- Architecture and design patterns
- Security vulnerabilities
- Error handling completeness
- Performance bottlenecks
- Test coverage
- Documentation quality
- Operational readiness

### 10.2 Monitoring and Metrics
Track:
- API response times
- Error rates by type
- Rate limit hits
- Resource usage
- User adoption

### 10.3 User Feedback
- Monitor GitHub issues
- Respond to questions promptly
- Implement requested features
- Fix reported bugs quickly
- Maintain changelog

## Common Pitfalls to Avoid

1. **Don't use console.log in STDIO mode** - Use stderr for logs
2. **Don't hardcode credentials** - Always use environment variables
3. **Don't fetch unlimited data** - Always set default limits
4. **Don't ignore error handling** - Wrap all external calls
5. **Don't skip input validation** - Validate everything
6. **Don't expose internal errors** - Sanitize error messages
7. **Don't forget rate limiting** - Protect your API
8. **Don't neglect documentation** - It's as important as code

## Success Criteria

Your MCP server is production-ready when:
- ✅ All tools work reliably with proper error handling
- ✅ Security measures are comprehensive
- ✅ Performance is optimized with sensible defaults
- ✅ Tests provide >80% coverage
- ✅ Documentation is complete and helpful
- ✅ Monitoring and logging are implemented
- ✅ Deployment is straightforward
- ✅ Code follows clean architecture principles

## Example Implementation Flow

1. **Week 1**: Setup and core implementation
2. **Week 2**: Security and reliability features
3. **Week 3**: Performance optimization and testing
4. **Week 4**: Documentation and deployment preparation

## Resources

- MCP SDK Documentation: https://modelcontextprotocol.io
- Service API Documentation: [Service specific docs]
- Example implementations: https://github.com/modelcontextprotocol

## Final Checklist

Before considering your MCP server complete:
- [ ] Can handle large datasets without crashing
- [ ] Properly authenticates and authorizes requests
- [ ] Gracefully handles API errors and rate limits
- [ ] Has comprehensive test coverage
- [ ] Includes detailed documentation
- [ ] Supports both STDIO and HTTP transports
- [ ] Implements proper logging and monitoring
- [ ] Follows security best practices
- [ ] Has clear deployment instructions
- [ ] Provides helpful error messages

Remember: A good MCP server is invisible to the user - it just works reliably and securely!