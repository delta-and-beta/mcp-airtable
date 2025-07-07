# Claude Prompts for MCP Airtable

This document provides example prompts for using the MCP Airtable server with Claude Desktop, especially when using per-request API keys.

## Basic Usage with Environment API Key

When the API key is configured in the environment, you can use simple prompts:

```
"List all tables in my Airtable base"
```

```
"Show me all records in the Customers table"
```

```
"Create a new record in the Orders table with these fields:
- Customer: John Doe
- Amount: $150.00
- Status: Pending"
```

## Using Per-Request API Keys

When the server doesn't have an environment API key, provide credentials in your prompt:

### Simple Format

```
"Using API key patXXXXXXXXXXXXXX and base appYYYYYYYYYYYYYY, list all tables"
```

### Structured Format

```
"I need to access my Airtable database:
- API Key: patXXXXXXXXXXXXXX
- Base ID: appYYYYYYYYYYYYYY

Please:
1. List all tables
2. Show the schema for the Customers table
3. Get the first 10 records from Orders"
```

### Multi-Base Operations

```
"I have multiple Airtable bases to work with:

Base 1 - Production:
- API Key: patPRODUCTIONKEY
- Base ID: appPRODBASEID

Base 2 - Development:
- API Key: patDEVELOPMENTKEY
- Base ID: appDEVBASEID

Please compare the table structures between these two bases."
```

## Advanced Operations

### Filtered Queries

```
"Using API key patXXXXXXXXXXXXXX, search the Products table in base appYYYYYYYYYYYYYY for:
- Items with price > 100
- Category = 'Electronics'
- In stock = true

Sort by price descending and limit to 20 results."
```

### Batch Operations

```
"With API key patXXXXXXXXXXXXXX and base appYYYYYYYYYYYYYY:

Create multiple records in the Inventory table:
1. Product: Laptop, SKU: LAP-001, Quantity: 50
2. Product: Mouse, SKU: MOU-002, Quantity: 200
3. Product: Keyboard, SKU: KEY-003, Quantity: 150

Use batch create for efficiency."
```

### Upsert Operations

```
"Using credentials:
- API Key: patXXXXXXXXXXXXXX
- Base: appYYYYYYYYYYYYYY

Upsert these customer records based on Email field:
1. Email: john@example.com, Name: John Doe, Status: Active
2. Email: jane@example.com, Name: Jane Smith, Status: Premium
3. Email: bob@example.com, Name: Bob Johnson, Status: Active

Create if they don't exist, update if they do."
```

## Working with Attachments

```
"API Key: patXXXXXXXXXXXXXX
Base: appYYYYYYYYYYYYYY

Upload the file '/path/to/document.pdf' and create a new record in Documents table:
- Title: Q4 Report
- Category: Financial
- Attachment: [the uploaded file]"
```

## Schema Operations (Enterprise)

```
"Using API key patXXXXXXXXXXXXXX:

Get the complete schema for base appYYYYYYYYYYYYYY including:
- All tables and their relationships
- Field types and configurations
- Views and their filters"
```

## Tips for Clear Communication

1. **Be explicit with credentials** - Always provide both API key and base ID when not using environment variables

2. **Use clear field names** - Match the exact field names in your Airtable base

3. **Specify operations clearly** - Use terms like "create", "update", "delete", "list", "search"

4. **Batch when possible** - For multiple operations, ask Claude to use batch operations

5. **Handle errors gracefully** - Ask Claude to check for errors and report them clearly

## Security Best Practices

1. **Never share real API keys** in public channels or screenshots

2. **Use read-only keys** when only reading data

3. **Rotate keys regularly** and update your Claude Desktop config

4. **Limit base access** using Airtable's built-in permissions

## Troubleshooting Prompts

```
"Check if my Airtable connection is working with:
- API Key: patXXXXXXXXXXXXXX
- Base: appYYYYYYYYYYYYYY

Try to list bases and report any errors."
```

```
"Debug why I can't access the Customers table. My credentials are:
- API Key: patXXXXXXXXXXXXXX
- Base: appYYYYYYYYYYYYYY

Check permissions and table existence."
```