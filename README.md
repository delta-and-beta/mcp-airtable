# MCP Airtable Server

An MCP (Model Context Protocol) server that provides tools for interacting with Airtable databases. This server allows AI assistants to perform CRUD operations on Airtable bases and tables.

## Features

- List available Airtable bases
- List tables within a base
- Get records with filtering, sorting, and field selection
- Create new records
- Update existing records
- Delete records
- Get base schema information
- **Access Control**: Restrict access to specific bases, tables, and views

## Access Control

The server supports comprehensive access control to limit what the AI can access:

```bash
# Allowlist mode - only allow specific items
ACCESS_CONTROL_MODE=allowlist
ALLOWED_BASES=appProductionData,appPublicData
ALLOWED_TABLES=Customers,Products,Orders
ALLOWED_VIEWS=Public View,Customer Facing

# Blocklist mode - block specific items
ACCESS_CONTROL_MODE=blocklist
BLOCKED_TABLES=Passwords,PersonalInfo,Salaries
BLOCKED_BASES=appSensitiveHR
```

**⚠️ Default Behavior**: If no access control variables are configured, the AI has access to ALL bases, tables, and views. Always configure access control for production deployments.

This prevents the AI from accessing sensitive data. See [Access Control Guide](docs/guides/access-control.md) for details.

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Airtable API key to `.env`:
   ```
   AIRTABLE_API_KEY=your_api_key_here
   ```

3. (Optional) Add a default base ID:
   ```
   AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
   ```

### Getting your Airtable API Key

1. Go to [Airtable account settings](https://airtable.com/account)
2. Navigate to the "API" section
3. Generate a personal access token with the following scopes:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`

## Usage

### Running the Server

For development with hot reload:
```bash
npm run dev
```

For production:
```bash
npm start
```

### Using with Claude Desktop

#### Option 1: Local Installation (Recommended)

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key_here",
        "AIRTABLE_BASE_ID": "optional_default_base_id",
        "AWS_REGION": "us-east-1",
        "AWS_S3_BUCKET": "your-bucket-name",
        "AWS_ACCESS_KEY_ID": "your-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret-key"
      }
    }
  }
}
```

#### Option 2: Remote Deployment (Zeabur)

1. **Deploy to Zeabur:**
   - Fork this repository
   - Connect your GitHub account to Zeabur
   - Create a new service and select this repository
   - Zeabur will automatically detect the Dockerfile

2. **Configure Environment Variables in Zeabur:**
   ```
   MCP_AUTH_TOKEN=your-secret-token
   AIRTABLE_API_KEY=your-airtable-api-key
   AIRTABLE_BASE_ID=your-default-base-id (optional)
   AWS_REGION=us-east-1 (optional)
   AWS_S3_BUCKET=your-bucket-name (optional)
   AWS_ACCESS_KEY_ID=your-key (optional)
   AWS_SECRET_ACCESS_KEY=your-secret (optional)
   ```

3. **Configure Claude Desktop for Remote MCP:**
   ```json
   {
     "mcpServers": {
       "airtable-remote": {
         "transport": "sse",
         "url": "https://your-app.zeabur.app/mcp",
         "headers": {
           "Authorization": "Bearer your-secret-token"
         }
       }
     }
   }
   ```

**Security Note:** When using remote deployment, always:
- Set a strong `MCP_AUTH_TOKEN`
- Use HTTPS only
- Keep your API keys secure in Zeabur's environment variables
- Never commit secrets to your repository

## Available Tools

### `list_bases`
List all available Airtable bases.

### `list_tables`
List all tables in a specific base.

**Parameters:**
- `baseId` (optional): The base ID. Uses default if not specified.

### `get_records`
Retrieve records from a table with optional filtering and sorting.

**Parameters:**
- `tableName` (required): The name of the table
- `baseId` (optional): The base ID
- `view` (optional): View name or ID
- `maxRecords` (optional): Maximum number of records to return
- `filterByFormula` (optional): Airtable formula for filtering
- `sort` (optional): Array of sort configurations
- `fields` (optional): Array of field names to return

### `create_record`
Create a new record in a table.

**Parameters:**
- `tableName` (required): The name of the table
- `fields` (required): Object containing field values
- `baseId` (optional): The base ID

### `update_record`
Update an existing record.

**Parameters:**
- `tableName` (required): The name of the table
- `recordId` (required): The ID of the record to update
- `fields` (required): Object containing fields to update
- `baseId` (optional): The base ID

### `delete_record`
Delete a record from a table.

**Parameters:**
- `tableName` (required): The name of the table
- `recordId` (required): The ID of the record to delete
- `baseId` (optional): The base ID

### `get_schema`
Get the schema information for a base.

**Parameters:**
- `baseId` (optional): The base ID

### `upload_attachment`
Upload a file to S3 and get a URL formatted for Airtable attachment fields. Requires AWS S3 configuration.

**Parameters:**
- `filePath` (optional): Local file path to upload
- `base64Data` (optional): Base64 encoded file data
- `filename` (required with base64Data): Filename for the attachment
- `contentType` (optional): MIME type of the file

**Returns:**
- `url`: Public URL of the uploaded file
- `filename`: Name of the file
- `size`: File size in bytes
- `type`: MIME type

**Example usage with create_record:**
```javascript
// First upload the file
const attachment = await upload_attachment({ filePath: '/path/to/image.jpg' });

// Then create/update record with attachment field
await create_record({
  tableName: 'Products',
  fields: {
    'Name': 'Product Name',
    'Images': [{ url: attachment.url, filename: attachment.filename }]
  }
});
```

## Development

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## Examples

### Getting Records with Filtering
```javascript
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Contacts",
    "filterByFormula": "AND({Status} = 'Active', {Age} > 25)",
    "sort": [{ "field": "Name", "direction": "asc" }],
    "maxRecords": 50
  }
}
```

### Creating a Record
```javascript
{
  "tool": "create_record",
  "arguments": {
    "tableName": "Contacts",
    "fields": {
      "Name": "John Doe",
      "Email": "john@example.com",
      "Status": "Active"
    }
  }
}
```

## Roadmap / TODO

### High Priority (Quick Wins)
- [ ] **Performance & Caching Layer** - Redis caching for schemas, records, and query results with TTL and invalidation
- [ ] **Health Check Endpoint** - `/health` endpoint with Airtable connectivity check for production monitoring
- [ ] **Natural Language Query Support** - Convert natural language to Airtable formulas (e.g., "customers from California who ordered last month")

### Medium Priority (High Value)
- [ ] **Field-Level Access Control** - Extend access control to specific fields with masking options
  ```bash
  ALLOWED_FIELDS=Customers:Name,Email;Orders:*
  BLOCKED_FIELDS=*:Password,*:SSN
  FIELD_MASKING=Email:partial,Phone:full
  ```
- [ ] **Schema Migration Tools** - Version control and migration tools for Airtable schemas
  - `compare_schemas` - Diff between environments
  - `migrate_schema` - Apply schema changes safely
  - `backup_schema` - Version control for structures
- [ ] **Bulk Import/Export** - Enhanced data migration capabilities
  - Smart CSV import with AI field mapping
  - Multi-format export (CSV, JSON, Excel)
  - Full base backup with attachments

### Future Enhancements
- [ ] **Real-time Change Notifications** - Webhook-based table watching for live updates
- [ ] **Transaction Support** - Atomic operations with rollback capability
- [ ] **Smart Data Operations**
  - Duplicate detection using AI
  - Data quality checks
  - Relationship suggestions
  - Auto field mapping
- [ ] **Operational Metrics** - Built-in observability with OpenTelemetry
  - Rate limit tracking
  - Operation latency metrics
  - Smart backoff strategies
- [ ] **Cost Optimization** - API usage tracking and query optimization suggestions
- [ ] **Enhanced Security**
  - Request signing with HMAC
  - Automatic PII detection
  - Audit logging with compliance exports
  - Field-level encryption
- [ ] **Developer Experience**
  - CLI for setup and management
  - TypeScript type generation from schemas
  - Interactive configuration wizard

### Contributing
Interested in contributing? Check out our [Contributing Guide](CONTRIBUTING.md) and pick an item from the roadmap!

## License

MIT