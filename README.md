# MCP Airtable Server

A Model Context Protocol (MCP) server that provides seamless integration with Airtable databases. This server enables AI assistants like Claude to interact with Airtable bases, tables, and records through a standardized interface.

## Features

- 🔧 **Full CRUD Operations**: Create, read, update, and delete records
- 📊 **Schema Inspection**: Explore base and table structures (Enterprise plan required)
- 🔍 **Advanced Filtering**: Use Airtable formulas for complex queries
- 📎 **Attachment Support**: Upload files to S3 or Google Cloud Storage
- 🔐 **Secure Authentication**: Token-based API authentication
- ⚡ **Rate Limiting**: Configurable request throttling
- 🚀 **Batch Operations**: Efficient bulk record operations
- 🛡️ **Access Control**: Fine-grained permissions for bases and tables

## Installation

### Using npm

```bash
npm install mcp-airtable
```

### Using Claude Desktop

#### Local Installation

Add the server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": ["mcp-airtable"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

#### Remote Server (mcp-remote)

For connecting to a remote MCP server, you can pass the API key via headers:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote", 
        "https://your-server.com/mcp",
        "--header",
        "x-airtable-api-key: your_api_key_here"
      ]
    }
  }
}
```

With both MCP authentication and Airtable API key:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote", 
        "https://your-server.com/mcp",
        "--header",
        "Authorization: Bearer your_mcp_auth_token",
        "--header",
        "x-airtable-api-key: your_api_key_here"
      ]
    }
  }
}
```

See the [MCP Remote Setup Guide](docs/mcp-remote-setup.md) for detailed configuration options.

## Configuration

The server is configured through environment variables. Create a `.env` file in your project root:

```bash
# Optional - Can be provided via request headers or tool arguments
AIRTABLE_API_KEY=your_airtable_api_key

# Required for production
MCP_AUTH_TOKEN=your_secure_auth_token

# Optional
AIRTABLE_BASE_ID=default_base_id
PORT=3000
NODE_ENV=production

# Storage Configuration (Optional)
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Or use Google Cloud Storage
GCS_BUCKET=your-bucket-name
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILE=/path/to/keyfile.json

# Access Control (Optional but recommended)
ALLOWED_BASES=base1,base2
ALLOWED_TABLES=table1,table2
ACCESS_CONTROL_MODE=allowlist

# Rate Limiting (Optional)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AIRTABLE_API_KEY` | Your Airtable API key (can also be passed via headers) | - | No* |
| `MCP_AUTH_TOKEN` | Bearer token for API authentication | - | Yes (production) |
| `AIRTABLE_BASE_ID` | Default base ID for operations | - | No |
| `PORT` | HTTP server port | 3000 | No |
| `NODE_ENV` | Environment (development/production/test) | production | No |
| `CORS_ORIGIN` | CORS allowed origins | * | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | info | No |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | true | No |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | Max requests per minute | 60 | No |

\* The Airtable API key can be provided in three ways (in order of precedence):
1. As a tool argument: `{ "airtableApiKey": "your_key" }`
2. Via HTTP headers: `x-airtable-api-key` or `Authorization: Bearer pat...` (case-insensitive)
3. As an environment variable: `AIRTABLE_API_KEY`

## Usage

### Running Locally (STDIO Mode)

For use with Claude Desktop or other local MCP clients:

```bash
npm start
```

### Running as HTTP Server

For production deployments or remote access:

```bash
npm run start:server
```

The HTTP server exposes a `/mcp` endpoint for MCP protocol communication.

## Available Tools

### Base Operations

- `list_bases` - List all available Airtable bases (Enterprise plan required)
- `get_schema` - Get the complete schema of a base (Enterprise plan required)

### Table Operations

- `list_tables` - List all tables in a base
- `create_table` - Create a new table with specified fields
- `update_table` - Update table properties (name or description)
- `list_views` - List all views in a table

### Record Operations

- `get_records` - Retrieve records with filtering and sorting
- `get_record` - Get a single record by ID
- `create_record` - Create a new record
- `update_record` - Update an existing record
- `delete_record` - Delete a record

### Batch Operations

- `batch_upsert` - Create or update multiple records
- `batch_delete` - Delete multiple records

### File Operations

- `upload_attachment` - Upload files for attachment fields

## Examples

### List all tables in a base

```json
{
  "tool": "list_tables",
  "arguments": {
    "baseId": "appXXXXXXXXXXXXXX"
  }
}
```

### Get records with filtering

```json
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Tasks",
    "filterByFormula": "AND({Status} = 'In Progress', {Priority} = 'High')",
    "maxRecords": 10,
    "sort": [
      { "field": "DueDate", "direction": "asc" }
    ]
  }
}
```

### Create a record

```json
{
  "tool": "create_record",
  "arguments": {
    "tableName": "Tasks",
    "fields": {
      "Name": "New Task",
      "Status": "Not Started",
      "Priority": "Medium"
    }
  }
}
```

### Create a table

```json
{
  "tool": "create_table",
  "arguments": {
    "name": "Projects",
    "description": "Track project progress",
    "fields": [
      {
        "name": "Name",
        "type": "singleLineText",
        "description": "Project name"
      },
      {
        "name": "Status",
        "type": "singleSelect",
        "options": {
          "choices": [
            { "name": "Planning", "color": "blueBright" },
            { "name": "In Progress", "color": "yellowBright" },
            { "name": "Completed", "color": "greenBright" }
          ]
        }
      },
      {
        "name": "Budget",
        "type": "currency",
        "options": {
          "precision": 2,
          "symbol": "$"
        }
      },
      {
        "name": "Start Date",
        "type": "date"
      },
      {
        "name": "Team Members",
        "type": "multipleCollaborators"
      }
    ]
  }
}
```

### Update a table

```json
{
  "tool": "update_table",
  "arguments": {
    "tableIdOrName": "Projects",
    "name": "Active Projects",
    "description": "Track all active project progress"
  }
}
```

### Upload an attachment

```json
{
  "tool": "upload_attachment",
  "arguments": {
    "filePath": "/path/to/file.pdf",
    "storageProvider": "s3"
  }
}
```

## Access Control

The server supports comprehensive access control to limit what bases, tables, and views can be accessed:

### Allowlist Mode
Only allow access to specific items:

```bash
ACCESS_CONTROL_MODE=allowlist
ALLOWED_BASES=appXXXXXXXXXXXXXX,appYYYYYYYYYYYYYY
ALLOWED_TABLES=Customers,Products,Orders
ALLOWED_VIEWS=Public View,Customer Facing
```

### Blocklist Mode
Block access to specific items:

```bash
ACCESS_CONTROL_MODE=blocklist
BLOCKED_TABLES=Passwords,PersonalInfo,Salaries
BLOCKED_BASES=appSensitiveData
```

### Both Mode
Combine allowlist and blocklist rules:

```bash
ACCESS_CONTROL_MODE=both
ALLOWED_BASES=appProductionData,appPublicData
BLOCKED_TABLES=Salaries,PersonalInfo
```

**⚠️ Important**: If no access control variables are configured, the AI has access to ALL bases, tables, and views. Always configure access control for production deployments.

## Architecture

The MCP Airtable server follows a clean, modular architecture:

```
src/
├── index.ts          # STDIO transport entry point
├── server.ts         # HTTP transport entry point
├── config/           # Configuration management
├── tools/            # Tool definitions and registry
├── handlers/         # Tool implementation handlers
├── services/         # External service clients
│   ├── airtable/     # Airtable API client
│   └── storage/      # S3/GCS clients
└── utils/            # Shared utilities
```

## Security Best Practices

1. **Authentication**: Always set `MCP_AUTH_TOKEN` in production
2. **API Keys**: Use Airtable Personal Access Tokens with minimal required scopes
3. **Access Control**: Configure allowed/blocked lists for bases and tables
4. **Rate Limiting**: Enable to prevent API abuse
5. **CORS**: Configure appropriate origins for your use case
6. **Environment Variables**: Never commit secrets to version control
7. **HTTPS**: Always use HTTPS in production deployments

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-airtable.git
cd mcp-airtable

# Install dependencies
npm install

# Build the project
npm run build
```

### Running in Development

```bash
# Run with hot reload (STDIO mode)
npm run dev

# Run HTTP server with hot reload
npm run dev:server
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment Variables

For production deployments, ensure all sensitive configuration is provided through environment variables or a secure configuration management system.

## Airtable Plan Limitations

Some features require specific Airtable plans:

- **Enterprise Plan Required**:
  - `list_bases` - List all bases
  - `get_schema` - Get base schema via Metadata API

- **All Plans**:
  - All other operations (CRUD, filtering, etc.)
  - Rate limit: 5 requests/second per base

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://github.com/your-org/mcp-airtable/wiki)
- 🐛 [Issue Tracker](https://github.com/your-org/mcp-airtable/issues)
- 💬 [Discussions](https://github.com/your-org/mcp-airtable/discussions)