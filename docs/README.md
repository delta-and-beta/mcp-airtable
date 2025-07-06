# MCP Airtable Documentation

Welcome to the comprehensive documentation for the MCP (Model Context Protocol) Airtable server. This documentation covers everything you need to know to deploy, configure, and use the MCP Airtable integration in production.

## 📚 Documentation Structure

### [Getting Started](./guides/getting-started.md)
Quick start guide to get you up and running with MCP Airtable.

### [API Reference](./api/README.md)
Complete reference for all available tools and their parameters.

### [Architecture](./architecture/README.md)
Deep dive into the system architecture, design decisions, and data flow.

### [Deployment Guide](./guides/deployment.md)
Step-by-step instructions for deploying to various platforms.

### [Security Guide](./guides/security.md)
Best practices for securing your MCP Airtable deployment.

### [Configuration](./guides/configuration.md)
Detailed configuration options and environment variables.

### [Troubleshooting](./guides/troubleshooting.md)
Common issues and their solutions.

### [Examples](./examples/README.md)
Real-world examples and use cases.

## 🚀 Quick Links

- [Local Development Setup](./guides/getting-started.md#local-development)
- [Zeabur Deployment](./guides/deployment.md#zeabur)
- [Tool Reference](./api/tools.md)
- [Security Best Practices](./guides/security.md#best-practices)

## 🔧 System Requirements

- Node.js 18+ (20+ recommended)
- npm or yarn
- Airtable account with API access
- (Optional) AWS account for S3 attachments
- (Optional) Zeabur account for remote deployment

## 📋 Feature Overview

### Core Features
- ✅ Full CRUD operations on Airtable records
- ✅ Base and table discovery
- ✅ Schema introspection
- ✅ Advanced filtering and sorting
- ✅ Attachment upload via S3
- ✅ Rate limiting (respects Airtable limits)
- ✅ Input validation
- ✅ Comprehensive error handling

### Security Features
- ✅ Bearer token authentication
- ✅ Environment variable validation
- ✅ Input sanitization
- ✅ Secure error messages
- ✅ Request logging

### Production Features
- ✅ Health checks
- ✅ Graceful shutdown
- ✅ Structured logging
- ✅ SSE transport for remote deployment
- ✅ Docker support

## 🔒 Security Notice

This server handles sensitive API keys and data. Please review the [Security Guide](./guides/security.md) before deploying to production.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct before submitting pull requests.

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- GitHub Issues: [Report bugs or request features](https://github.com/your-repo/issues)
- Documentation: [Browse all docs](./README.md)
- Examples: [See working examples](./examples/README.md)