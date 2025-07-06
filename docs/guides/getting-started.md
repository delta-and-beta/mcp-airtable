# Getting Started

This guide will help you get up and running with the MCP Airtable server in under 10 minutes.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 18+ installed ([Download](https://nodejs.org/))
- ✅ An Airtable account with API access
- ✅ Claude Desktop installed
- ✅ Basic command line knowledge

## Quick Start

### 1. Get Your Airtable API Key

1. Go to [Airtable Account Settings](https://airtable.com/account)
2. Click on "Personal access tokens"
3. Click "Create token"
4. Give it a name (e.g., "MCP Server")
5. Select these scopes:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
6. Click "Create token"
7. Copy the token (starts with `pat`)

> ⚠️ **Important**: Save this token securely. You won't be able to see it again!

### 2. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/mcp-airtable.git
cd mcp-airtable

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API key
# Use your favorite editor (nano, vim, code, etc.)
nano .env
```

In your `.env` file:
```env
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX  # Your actual API key
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX  # Optional: default base
```

### 3. Build the Server

```bash
npm run build
```

### 4. Configure Claude Desktop

Find your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/full/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX"
      }
    }
  }
}
```

> 📝 **Note**: Replace `/full/path/to/mcp-airtable` with the actual path where you cloned the repository.

### 5. Restart Claude Desktop

Quit and restart Claude Desktop for the changes to take effect.

### 6. Test the Connection

In Claude Desktop, try:

```
Can you list my Airtable bases?
```

If everything is configured correctly, Claude should list your available Airtable bases.

## Your First Commands

### List Your Bases

Ask Claude:
```
What Airtable bases do I have access to?
```

### List Tables in a Base

```
Show me the tables in my [Base Name] base
```

### Get Records

```
Get the first 10 records from the Contacts table
```

### Create a Record

```
Create a new contact with name "John Doe" and email "john@example.com"
```

### Search Records

```
Find all contacts where Status is "Active"
```

## Local Development

### Running in Development Mode

For development with hot reload:

```bash
# Start the development server
npm run dev

# In another terminal, test the server
curl http://localhost:3000/health
```

### Testing Your Setup

1. **Test Airtable Connection**:
   ```bash
   # Create a test script
   cat > test-connection.js << 'EOF'
   require('dotenv').config();
   const { AirtableClient } = require('./dist/airtable/client.js');
   
   const client = new AirtableClient({
     apiKey: process.env.AIRTABLE_API_KEY
   });
   
   client.listBases()
     .then(bases => console.log('Success! Found', bases.length, 'bases'))
     .catch(err => console.error('Error:', err.message));
   EOF
   
   # Run it
   node test-connection.js
   ```

2. **Test with Claude Desktop**:
   - Ensure Claude Desktop is restarted
   - Look for "MCP" indicator in Claude's interface
   - Try basic commands

### Common Development Tasks

#### Add a New Base

```javascript
// In Claude Desktop config
{
  "mcpServers": {
    "airtable-dev": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appDevelopment123"
      }
    },
    "airtable-prod": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "patYYYYYYYYYYYYYY",
        "AIRTABLE_BASE_ID": "appProduction456"
      }
    }
  }
}
```

#### Enable S3 Uploads

Add to your `.env`:
```env
# S3 Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-airtable-attachments
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Then in Claude:
```
Upload the file photo.jpg and add it to the Products table
```

## Example Workflows

### 1. Contact Management

```
# List all contacts
Show me all contacts in the CRM base

# Filter contacts
Find contacts where "Last Contact Date" is before 2024-01-01

# Update a contact
Update contact rec123456 with Status = "Inactive"

# Bulk operations
Get all contacts with tag "customer" and update their Priority to "High"
```

### 2. Inventory Tracking

```
# Check stock levels
Show products where "Stock Level" is less than 10

# Update inventory
Decrease the stock level of SKU-12345 by 5

# Add new product
Create a product with Name="Widget Pro", SKU="SKU-99999", Stock=100
```

### 3. Content Calendar

```
# View upcoming content
Get all posts where "Publish Date" is after today, sorted by date

# Update post status
Change the status of "Blog Post Draft" to "Published"

# Attach media
Upload thumbnail.jpg and attach it to the "Holiday Campaign" record
```

## Best Practices

### 1. Use Specific Table Names

Instead of:
```
Get records from the first table
```

Use:
```
Get records from the Contacts table
```

### 2. Filter Data Efficiently

Instead of:
```
Get all records and find the ones where status is active
```

Use:
```
Get records where Status = "Active"
```

### 3. Limit Large Queries

Instead of:
```
Get all 10,000 products
```

Use:
```
Get the first 100 products sorted by creation date
```

### 4. Use Views When Available

```
Get records from the "Active Customers" view in the Contacts table
```

## Troubleshooting Quick Fixes

### "Airtable API key is required"
- Check your `.env` file exists
- Verify the key name is `AIRTABLE_API_KEY`
- Ensure no quotes around the key value

### "Connection refused"
- Make sure you built the project: `npm run build`
- Check the path in Claude Desktop config is correct
- Restart Claude Desktop

### "Invalid base ID"
- Base IDs start with `app` followed by 14 characters
- Find it in your Airtable URL
- Check for extra spaces or characters

### "Rate limit exceeded"
- Airtable allows 5 requests per second
- Add delays between bulk operations
- Use filtering to reduce requests

## Next Steps

Now that you have the basics working:

1. 📖 Read the [API Reference](../api/README.md) for all available tools
2. 🔒 Review the [Security Guide](./security.md) for production use
3. 🚀 Check the [Deployment Guide](./deployment.md) for remote setup
4. 🎯 See [Examples](../examples/README.md) for advanced use cases

## Getting Help

- 📝 Check the [Troubleshooting Guide](./troubleshooting.md)
- 🐛 Report issues on [GitHub](https://github.com/your-repo/issues)
- 💬 Ask questions in discussions

Happy building with MCP Airtable! 🎉