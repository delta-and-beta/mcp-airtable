# MCP Airtable Documentation

Welcome to the comprehensive documentation for the MCP (Model Context Protocol) Airtable server. This documentation covers everything you need to know to deploy, configure, and use the MCP Airtable integration.

## 📚 Documentation Structure

### Getting Started
- [Installation & Setup](../README.md#installation)
- [Claude Desktop Configuration](../deploy/claude-desktop/README.md)
- [API Key Authentication](../README.md#api-key-authentication)

### Usage Guides
- [Claude Prompts Examples](./examples/claude-prompts.md) - **NEW!** How to use per-request API keys
- [Access Control Guide](./guides/access-control.md)
- [MCP Auth Token Setup](./guides/mcp-auth-token-setup.md)

### Deployment
- [Deployment Overview](../deploy/README.md)
- [Docker Deployment](../deploy/docker/README.md) 
- [Railway Deployment](../deploy/railway/README.md)

### API Reference
- [Available Tools](../README.md#available-tools)
- [Configuration Options](../README.md#configuration-options)

### Examples
- [Claude Prompts](./examples/claude-prompts.md) - Example prompts for Claude Desktop
- [API Examples](../README.md#api-examples)

## 🚀 What's New

### Per-Request API Keys
The server now supports providing Airtable API keys with each request, enabling:
- Multi-tenant scenarios
- Dynamic credential management  
- Enhanced security (no keys in config files)

[Learn more →](./examples/claude-prompts.md)

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
- ✅ Schema introspection (Enterprise plan)
- ✅ Advanced filtering and sorting
- ✅ Attachment upload via S3/GCS
- ✅ Rate limiting with Redis support
- ✅ Batch operations for efficiency
- ✅ Comprehensive error handling

### Security Features
- ✅ Bearer token authentication
- ✅ Per-request API key support **NEW!**
- ✅ Environment variable validation
- ✅ Access control lists
- ✅ Production security headers
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