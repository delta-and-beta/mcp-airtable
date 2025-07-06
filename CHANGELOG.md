# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-06

### Added
- Initial release of MCP Airtable Server
- Core MCP server implementation with stdio and SSE transports
- Comprehensive Airtable integration with rate limiting
- Tool implementations:
  - `list_bases` - List available Airtable bases
  - `list_tables` - List tables in a base
  - `list_views` - List views in a table
  - `get_records` - Retrieve records with filtering and sorting
  - `create_record` - Create new records with typecast support
  - `update_record` - Update existing records
  - `delete_record` - Delete records
  - `get_schema` - Get base schema information
  - `batch_create` - Create multiple records efficiently
  - `batch_update` - Update multiple records
  - `batch_delete` - Delete multiple records
  - `batch_upsert` - Intelligent upsert with AI-powered field detection
  - `upload_attachment` - Upload files to S3/GCS
- Storage support for AWS S3 and Google Cloud Storage
- Redis queue support for high-volume operations
- Advanced rate limiting with exponential backoff
- Comprehensive error handling and logging
- TypeScript with strict type safety
- Docker support with multi-stage builds
- Deployment configurations for multiple platforms
- Security features:
  - Input sanitization
  - Path traversal protection
  - Bearer token authentication
  - Environment variable validation
- Development tooling:
  - ESLint configuration
  - Jest testing framework
  - TypeScript configuration
  - Git Flow workflow support

### Security
- Implemented comprehensive input validation
- Added path traversal protection for file uploads
- Secure handling of API keys and secrets
- Rate limiting to prevent abuse

[1.0.0]: https://github.com/delta-and-beta/mcp-airtable/releases/tag/v1.0.0