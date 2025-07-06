# Architecture Overview

This document provides a comprehensive overview of the MCP Airtable server architecture, including system design, data flow, and key components.

## System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Desktop │────▶│   MCP Server     │────▶│    Airtable     │
│   (Client)      │◀────│                  │◀────│      API        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           
                               ▼                           
                        ┌──────────────────┐              
                        │    AWS S3        │              
                        │  (Attachments)   │              
                        └──────────────────┘              
```

## Component Overview

### 1. Transport Layer

The server supports two transport mechanisms:

#### **stdio (Local)**
- Used for local Claude Desktop integration
- Communicates via standard input/output
- No network exposure
- Direct process communication

#### **SSE (Remote)**
- Server-Sent Events for remote deployment
- HTTP-based transport
- Supports authentication headers
- Suitable for cloud deployment (Zeabur, etc.)

### 2. Core Components

#### **MCP Server Core**
- Handles protocol communication
- Routes tool requests to handlers
- Manages request/response lifecycle
- Provides error handling

#### **Tool Handlers**
- Individual functions for each tool
- Input validation using Zod schemas
- Type-safe implementations
- Consistent error handling

#### **Airtable Client**
- Wrapper around Airtable SDK
- Handles API communication
- Manages authentication
- Provides typed responses

#### **S3 Client**
- Handles file uploads
- Manages S3 bucket operations
- Generates public URLs
- Supports multiple upload methods

### 3. Supporting Services

#### **Configuration Management**
- Environment variable validation
- Type-safe configuration
- Startup validation
- Development/production modes

#### **Rate Limiter**
- Enforces Airtable API limits (5 req/sec)
- Per-base rate limiting
- Request queuing
- Backpressure handling

#### **Logger**
- Structured logging
- Multiple log levels
- Request tracking
- Error context

#### **Error Handler**
- Consistent error formatting
- Security-aware responses
- Development vs production modes
- Error classification

## Data Flow

### 1. Request Flow

```
Client Request
    │
    ▼
Transport Layer (stdio/SSE)
    │
    ▼
Authentication Middleware
    │
    ▼
Request Validation
    │
    ▼
Tool Handler Selection
    │
    ▼
Input Validation (Zod)
    │
    ▼
Rate Limiting Check
    │
    ▼
Business Logic Execution
    │
    ▼
External API Call (Airtable/S3)
    │
    ▼
Response Formatting
    │
    ▼
Client Response
```

### 2. Error Flow

```
Error Occurrence
    │
    ▼
Error Classification
    │
    ├─▶ ValidationError ──▶ 400 Bad Request
    ├─▶ AuthenticationError ──▶ 401 Unauthorized
    ├─▶ RateLimitError ──▶ 429 Too Many Requests
    ├─▶ AirtableError ──▶ 502 Bad Gateway
    └─▶ InternalError ──▶ 500 Internal Server Error
         │
         ▼
    Error Logging
         │
         ▼
    Safe Error Response
```

## Security Architecture

### 1. Authentication Flow

```
Request with Bearer Token
    │
    ▼
Extract Authorization Header
    │
    ▼
Validate Token Format
    │
    ▼
Compare with MCP_AUTH_TOKEN
    │
    ├─▶ Valid ──▶ Continue
    └─▶ Invalid ──▶ 401 Response
```

### 2. Input Validation

- **Schema-based validation** using Zod
- **Type checking** at compile time
- **Runtime validation** for all inputs
- **Sanitization** of user inputs
- **Injection prevention**

### 3. Secret Management

- API keys stored in environment variables
- No secrets in code or logs
- Secure error messages
- Environment validation on startup

## Scalability Considerations

### 1. Connection Management

- **Singleton pattern** for clients
- **Lazy initialization**
- **Connection reuse**
- **Graceful shutdown**

### 2. Performance Optimizations

- **Rate limiting** to prevent API abuse
- **Efficient error handling**
- **Minimal memory footprint**
- **Stream processing** for file uploads

### 3. Deployment Patterns

#### **Local Deployment**
- Single instance
- Direct process communication
- No network overhead
- Immediate responses

#### **Remote Deployment**
- Horizontal scaling possible
- Load balancer compatible
- Stateless design
- Health check endpoints

## Technology Stack

### Core Technologies
- **Node.js 20+**: Runtime environment
- **TypeScript 5+**: Type safety
- **Express 5**: HTTP server (SSE transport)
- **MCP SDK**: Protocol implementation

### Key Libraries
- **Airtable.js**: Official Airtable SDK
- **AWS SDK v3**: S3 operations
- **Zod**: Schema validation
- **dotenv**: Environment management
- **mime-types**: Content type detection

### Development Tools
- **ESLint**: Code linting
- **Jest**: Testing framework
- **tsx**: TypeScript execution
- **Docker**: Containerization

## Design Decisions

### 1. TypeScript First
- Full type safety
- Better IDE support
- Catch errors at compile time
- Self-documenting code

### 2. Modular Architecture
- Separation of concerns
- Easy to test
- Maintainable codebase
- Extensible design

### 3. Environment-based Configuration
- No hardcoded values
- Easy deployment
- Security best practices
- Multiple environment support

### 4. Error-First Design
- Comprehensive error handling
- Graceful degradation
- Clear error messages
- Debugging support

## Future Architecture Considerations

### 1. Caching Layer
- Redis for frequently accessed data
- Schema caching
- Response caching
- Cache invalidation strategies

### 2. Message Queue
- Handle burst traffic
- Async processing
- Better reliability
- Retry mechanisms

### 3. Monitoring Integration
- OpenTelemetry support
- Distributed tracing
- Metrics collection
- Alert management

### 4. Multi-tenancy
- Per-client rate limiting
- Usage tracking
- Billing integration
- Tenant isolation