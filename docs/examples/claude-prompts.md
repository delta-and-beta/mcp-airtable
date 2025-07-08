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

## Creating Tables

### Simple Table Creation

```
"Using API key patXXXXXXXXXXXXXX and base appYYYYYYYYYYYYYY:

Create a new table called 'Projects' with these fields:
- Name (text)
- Description (multiline text)
- Status (dropdown with options: Planning, Active, Completed)
- Budget (currency)
- Start Date (date)
- End Date (date)
- Team Lead (single collaborator)"
```

### Complex Table with Linked Records

```
"With credentials:
- API Key: patXXXXXXXXXXXXXX
- Base: appYYYYYYYYYYYYYY

Create a 'Tasks' table that links to the existing 'Projects' table:
1. Task Name (single line text)
2. Description (rich text)
3. Project (linked to Projects table, single link)
4. Assigned To (multiple collaborators)
5. Priority (single select: Low, Medium, High, Urgent)
6. Due Date (date)
7. Completed (checkbox)
8. Time Spent (duration in hours)
9. Attachments (multiple attachments)

Make sure the Project field properly links to the Projects table."
```

### Table with Computed Fields

```
"API Key: patXXXXXXXXXXXXXX
Base: appYYYYYYYYYYYYYY

Create an 'Invoices' table with:
- Invoice Number (auto number)
- Client Name (single line text)
- Items (multiline text)
- Subtotal (currency)
- Tax Rate (percent)
- Total (formula: calculate from Subtotal and Tax Rate)
- Status (single select: Draft, Sent, Paid, Overdue)
- Issue Date (date)
- Due Date (date)
- Created Time (created time field)
- Last Modified (last modified time field)"
```

## Using Typecast Option

The typecast option automatically converts values to match field types (e.g., string "100" to number 100). You can enable it:

### In Individual Operations

```
"Using API key patXXXXXXXXXXXXXX and base appYYYYYYYYYYYYYY:

Create a record in the Products table with typecast enabled:
- Name: Widget
- Price: '99.99' (will be converted to number)
- InStock: 'true' (will be converted to boolean)
- Quantity: '50' (will be converted to number)"
```

### With Batch Operations

```
"API Key: patXXXXXXXXXXXXXX
Base: appYYYYYYYYYYYYYY

Import these CSV-style records into the Inventory table with typecast=true:
1. SKU-001, '100', '29.99', 'true'
2. SKU-002, '50', '49.99', 'false'
3. SKU-003, '75', '39.99', 'true'

The string values should be automatically converted to numbers and booleans."
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