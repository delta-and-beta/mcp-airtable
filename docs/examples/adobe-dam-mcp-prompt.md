# Adobe DAM MCP Development Prompt

## Project Overview

Create a Model Context Protocol (MCP) server that integrates with Adobe Experience Manager (AEM) Digital Asset Management (DAM). This server should enable AI assistants to interact with Adobe DAM for asset management, metadata operations, and content workflows.

## Core Requirements

### 1. Authentication & Configuration
- Support Adobe IMS (Identity Management System) OAuth 2.0 authentication
- Handle API key authentication for service-to-service integration
- Support multiple Adobe organizations and environments (dev, stage, prod)
- Secure credential storage with environment variables
- Automatic token refresh for long-running operations

### 2. MCP Tool Implementation

Implement the following tools following MCP best practices:

#### Asset Management Tools
- `search_assets` - Search assets with filters (tags, metadata, collections)
- `get_asset` - Retrieve asset details including metadata and renditions
- `upload_asset` - Upload new assets with metadata
- `update_asset_metadata` - Modify asset metadata and properties
- `delete_asset` - Remove assets (with confirmation safeguards)
- `move_asset` - Move assets between folders
- `copy_asset` - Duplicate assets with new metadata

#### Rendition Tools
- `list_renditions` - Get available renditions for an asset
- `create_rendition` - Generate new renditions with specifications
- `download_rendition` - Retrieve specific rendition
- `get_original` - Download original asset file

#### Collection & Folder Tools
- `list_folders` - Browse folder hierarchy
- `create_folder` - Create new folders with metadata
- `list_collections` - Get available collections
- `manage_collection` - Add/remove assets from collections
- `share_collection` - Generate shareable links

#### Metadata Tools
- `get_metadata_schemas` - List available metadata schemas
- `bulk_update_metadata` - Update metadata for multiple assets
- `export_metadata` - Export metadata in various formats (CSV, JSON, XML)
- `validate_metadata` - Check metadata against schemas

#### Workflow Tools
- `list_workflows` - Get available DAM workflows
- `start_workflow` - Initiate workflow on assets
- `check_workflow_status` - Monitor workflow progress
- `approve_asset` - Approve assets in review workflows

### 3. Technical Architecture

#### Project Structure
```
mcp-adobe-dam/
├── src/
│   ├── index.ts              # MCP server entry
│   ├── server.ts             # Server implementation
│   ├── adobe/
│   │   ├── client.ts         # Adobe API client
│   │   ├── auth.ts           # IMS authentication
│   │   ├── types.ts          # TypeScript definitions
│   │   └── utils.ts          # Helper functions
│   ├── handlers/
│   │   ├── assets.ts         # Asset operations
│   │   ├── metadata.ts       # Metadata operations
│   │   ├── collections.ts    # Collection management
│   │   ├── workflows.ts      # Workflow operations
│   │   └── renditions.ts     # Rendition handling
│   ├── utils/
│   │   ├── rate-limiter.ts   # API rate limiting
│   │   ├── cache.ts          # Response caching
│   │   ├── validation.ts     # Input validation
│   │   ├── errors.ts         # Error handling
│   │   └── logger.ts         # Structured logging
│   └── resources/
│       └── schemas.ts        # MCP resource providers
├── tests/
├── docs/
└── deploy/
```

#### Key Dependencies
- `@adobe/aem-sdk-api` - Adobe SDK for AEM
- `@modelcontextprotocol/sdk` - MCP SDK
- `axios` - HTTP client with retry logic
- `form-data` - Multipart upload support
- `sharp` - Image processing for renditions
- `p-queue` - Concurrent operation management

### 4. Adobe-Specific Features

#### Asset Processing
- Support for all Adobe-supported file types (images, videos, documents, 3D)
- Smart tagging integration
- Color profile handling
- XMP metadata support
- Dynamic Media integration

#### Performance Optimization
- Implement intelligent caching for frequently accessed assets
- Batch API operations where possible
- Progressive asset loading for large files
- Efficient pagination for search results
- Connection pooling for API requests

#### Error Handling
- Comprehensive error messages with Adobe error codes
- Retry logic for transient failures
- Graceful degradation for missing permissions
- Clear feedback for quota/limit exceeded
- Detailed logging for troubleshooting

### 5. Security Requirements

- Implement access control based on Adobe permissions
- Sanitize all file uploads and metadata inputs
- Secure handling of authentication tokens
- Audit logging for all operations
- Support for enterprise proxy configurations
- Encryption for sensitive data at rest

### 6. Developer Experience

#### Documentation
- Comprehensive README with Adobe DAM setup guide
- API authentication walkthrough
- Example usage for each tool
- Troubleshooting guide for common Adobe errors
- Performance optimization tips

#### Configuration
- Environment variable templates
- Support for `.env` files
- Configuration validation on startup
- Multi-environment setup guide
- Docker support for containerized deployments

#### Testing
- Mock Adobe API responses for unit tests
- Integration test suite with test account
- Performance benchmarks
- Error scenario coverage

### 7. Deployment Options

Provide deployment configurations for:
- Local development (Claude Desktop)
- Docker containers
- Cloud platforms (AWS, Azure, GCP)
- Kubernetes with Helm charts
- Serverless functions (Lambda, Cloud Functions)

### 8. Advanced Features

#### Batch Operations
- Bulk asset upload with progress tracking
- Mass metadata updates with rollback
- Batch rendition generation
- Collection operations on multiple assets

#### Integration Features
- Webhook support for asset events
- Export to external systems (S3, Google Cloud Storage)
- Import from various sources (URLs, cloud storage)
- Creative Cloud Libraries integration

#### AI/ML Enhancements
- Auto-tagging suggestions
- Similar asset search
- Content-aware cropping
- Metadata enrichment from AI services

### 9. Monitoring & Observability

- Health check endpoints
- Prometheus metrics export
- Structured logging with correlation IDs
- Performance metrics (API latency, throughput)
- Adobe API quota tracking
- Error rate monitoring

### 10. Example Usage Scenarios

Provide code examples for:
- Setting up a brand portal with assets
- Automated asset workflow processing
- Bulk metadata updates from spreadsheet
- Asset migration between environments
- Rights management workflow
- Dynamic rendition generation

## Success Criteria

The MCP server should:
1. Handle all common Adobe DAM operations reliably
2. Provide clear, actionable error messages
3. Respect Adobe API rate limits automatically
4. Support enterprise-scale operations (thousands of assets)
5. Maintain security best practices
6. Be easily deployable in various environments
7. Include comprehensive documentation
8. Pass all unit and integration tests
9. Handle authentication seamlessly
10. Provide excellent developer experience

## Additional Considerations

- Support for Adobe's latest API versions
- Backward compatibility for older AEM versions
- Internationalization for metadata
- Support for custom metadata schemas
- Integration with Adobe Analytics for asset usage
- Compliance with data residency requirements

Build this with the same attention to detail, error handling, security, and deployment flexibility as the Airtable MCP implementation.