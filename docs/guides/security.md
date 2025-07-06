# Security Guide

This guide covers security best practices for deploying and operating the MCP Airtable server in production environments.

## Security Overview

The MCP Airtable server handles sensitive data including API keys and database records. This guide helps you secure your deployment against common threats.

## Threat Model

### Primary Threats

1. **Unauthorized Access**
   - Accessing MCP endpoints without authentication
   - API key theft or exposure
   - Session hijacking

2. **Data Exposure**
   - Sensitive data in logs
   - Error messages revealing system details
   - Unencrypted data transmission

3. **Injection Attacks**
   - Airtable formula injection
   - Path traversal in file uploads
   - Command injection

4. **Denial of Service**
   - Rate limit bypass
   - Resource exhaustion
   - Memory leaks

## Security Features

### Built-in Security

✅ **Bearer Token Authentication**
- Required for SSE transport
- Per-request validation
- Constant-time comparison

✅ **Input Validation**
- Zod schema validation
- Type checking
- Sanitization

✅ **Rate Limiting**
- Respects Airtable limits
- Prevents API abuse
- Request queuing

✅ **Secure Error Handling**
- No sensitive data in production errors
- Structured error responses
- Error classification

✅ **Environment Validation**
- Startup configuration checks
- Required variables enforcement
- Type validation

## Best Practices

### 1. Authentication & Authorization

#### Strong Authentication Tokens
```bash
# Generate a secure token
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Token Management
- Rotate tokens regularly (every 90 days)
- Use different tokens for each environment
- Never commit tokens to version control
- Use secret management services in cloud

#### Example secure configuration:
```json
{
  "mcpServers": {
    "airtable-production": {
      "transport": "sse",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${SECURE_TOKEN_FROM_ENV}"
      }
    }
  }
}
```

### 2. API Key Security

#### Airtable API Keys
- Use scoped personal access tokens when possible
- Limit permissions to minimum required
- Separate keys for different environments
- Monitor key usage

#### AWS Credentials
- Use IAM roles when possible
- Apply least privilege principle
- Enable MFA for AWS accounts
- Use temporary credentials

#### Environment Variables
```bash
# Good: Load from secure secret manager
export AIRTABLE_API_KEY=$(aws secretsmanager get-secret-value --secret-id prod/airtable/api-key --query SecretString --output text)

# Bad: Hardcoded in scripts
export AIRTABLE_API_KEY="pat123456789..."
```

### 3. Network Security

#### HTTPS Only
- Always use HTTPS in production
- Enable HSTS headers
- Use TLS 1.2 or higher
- Valid SSL certificates

#### CORS Configuration
```typescript
// Restrictive CORS for production
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://app.example.com',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));
```

#### Firewall Rules
- Restrict inbound traffic to HTTPS (443)
- Limit outbound to required services
- Use VPC/private networking where possible
- Enable DDoS protection

### 4. Input Validation

#### Sanitize All Inputs
```typescript
// File upload validation
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 255);
};

// Formula validation
const validateFormula = (formula: string): void => {
  const dangerous = ['EVAL', 'EXEC', 'SYSTEM'];
  if (dangerous.some(cmd => formula.toUpperCase().includes(cmd))) {
    throw new ValidationError('Invalid formula');
  }
};
```

#### Prevent Path Traversal
```typescript
const validatePath = (filepath: string): void => {
  if (filepath.includes('..') || filepath.includes('~')) {
    throw new ValidationError('Invalid file path');
  }
};
```

### 5. Logging & Monitoring

#### Secure Logging
```typescript
// Good: Mask sensitive data
logger.info('API call made', {
  user: userId,
  action: 'create_record',
  table: tableName,
  // Don't log: API keys, record data, tokens
});

// Bad: Logging sensitive data
logger.info('Request', { 
  apiKey: req.headers.authorization // NEVER DO THIS
});
```

#### Audit Logging
- Log all authentication attempts
- Track data modifications
- Monitor failed requests
- Set up alerts for anomalies

### 6. Error Handling

#### Production Error Responses
```typescript
// Good: Generic error for production
if (process.env.NODE_ENV === 'production') {
  return {
    error: 'An error occurred',
    code: 'INTERNAL_ERROR',
    requestId: generateRequestId()
  };
}

// Development: Include details
return {
  error: error.message,
  stack: error.stack,
  code: error.code
};
```

### 7. Rate Limiting & DoS Protection

#### Enhanced Rate Limiting
```typescript
// Per-client rate limiting
const clientRateLimiter = new Map<string, RateLimiter>();

const getClientLimiter = (clientId: string): RateLimiter => {
  if (!clientRateLimiter.has(clientId)) {
    clientRateLimiter.set(clientId, new RateLimiter({
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    }));
  }
  return clientRateLimiter.get(clientId)!;
};
```

#### Resource Limits
```typescript
// Limit request size
app.use(express.json({ limit: '10mb' }));

// Limit file upload size
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Connection limits
const MAX_CONNECTIONS = 100;
```

### 8. Dependency Security

#### Regular Updates
```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Fix vulnerabilities
npm audit fix
```

#### Dependency Scanning
- Use tools like Snyk or Dependabot
- Automated security updates
- License compliance checks
- Supply chain security

### 9. Container Security

#### Secure Docker Images
```dockerfile
# Use specific version, not latest
FROM node:20.11-alpine

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy only necessary files
COPY --chown=nodejs:nodejs . .

USER nodejs
```

#### Image Scanning
```bash
# Scan for vulnerabilities
docker scan mcp-airtable:latest

# Use minimal base images
# Alpine Linux reduces attack surface
```

### 10. Incident Response

#### Preparation
1. Document security contacts
2. Create incident response plan
3. Set up monitoring alerts
4. Regular security drills

#### Detection
- Monitor for unusual API usage
- Track authentication failures
- Watch for data exfiltration patterns
- Set up automated alerts

#### Response Steps
1. **Isolate** - Disable affected components
2. **Investigate** - Analyze logs and metrics
3. **Remediate** - Apply fixes
4. **Recover** - Restore normal operations
5. **Review** - Post-incident analysis

## Security Checklist

### Pre-Deployment
- [ ] All API keys in environment variables
- [ ] Strong authentication tokens generated
- [ ] HTTPS configured and tested
- [ ] Input validation implemented
- [ ] Error messages sanitized
- [ ] Dependencies updated
- [ ] Security headers configured

### Deployment
- [ ] Production environment variables set
- [ ] Firewall rules configured
- [ ] DDoS protection enabled
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Incident response plan ready

### Post-Deployment
- [ ] Regular security audits
- [ ] Dependency updates scheduled
- [ ] Log monitoring active
- [ ] Performance baselines established
- [ ] Security training completed

## Compliance Considerations

### GDPR
- Data minimization
- Right to deletion support
- Data processing logs
- Privacy by design

### SOC 2
- Access controls
- Audit logging
- Change management
- Incident response

### HIPAA (if applicable)
- Encryption at rest and in transit
- Access controls and audit logs
- Business Associate Agreement
- Data retention policies

## Security Tools

### Recommended Tools
- **SAST**: ESLint security plugin
- **Dependency Scanning**: Snyk, npm audit
- **Container Scanning**: Trivy, Clair
- **Runtime Protection**: Node.js --secure flag
- **Monitoring**: DataDog, New Relic
- **Secret Management**: HashiCorp Vault, AWS Secrets Manager

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Email: security@example.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and provide regular updates on the fix progress.