# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: [security@delta-and-beta.com](mailto:security@delta-and-beta.com)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Fix timeline**: Depends on severity (critical: 24-72 hours, high: 1-2 weeks)

## Security Features

This MCP server implements the following security measures:

### Input Validation
- Path traversal prevention (blocks `..` and system directories)
- SQL injection pattern detection in Airtable formulas
- Dangerous function blocking (EVAL, EXEC, SYSTEM)
- File extension filtering (.exe, .bat, .cmd, .sh, .ps1 blocked)
- Base64 size limits (10MB max)

### Authentication
- API key extraction with clear priority (header > parameter > env)
- No hardcoded credentials
- Keys never logged or exposed in error messages

### Error Handling
- Custom error classes with MCP-standard codes
- No stack traces leaked to clients
- Sensitive data redacted in Sentry reports

### Data Protection
- API keys redacted in all logging
- Sentry `beforeSend` filters sensitive headers
- No PII collection by default

## Security Best Practices for Users

1. **Never commit API keys** - Use environment variables or secure header injection
2. **Use HTTPS** - Always deploy behind TLS in production
3. **Rotate keys regularly** - Airtable allows key regeneration
4. **Limit key scope** - Use scoped tokens when possible
5. **Monitor usage** - Enable Sentry for error tracking

## Dependencies

We regularly audit dependencies using `npm audit` and update vulnerable packages promptly.

To check for vulnerabilities:
```bash
npm audit
```

To fix vulnerabilities:
```bash
npm audit fix
```
