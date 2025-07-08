# Testing x-airtable-option-max-records Header

## Test Scenarios

### 1. Test with Header Only
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  -H "x-airtable-api-key: YOUR_AIRTABLE_API_KEY" \
  -H "x-airtable-base-id: YOUR_BASE_ID" \
  -H "x-airtable-option-max-records: 50" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_records",
      "arguments": {
        "tableName": "YOUR_TABLE_NAME"
      }
    },
    "id": 1
  }'
```

### 2. Test with Both Header and Argument (Argument Should Win)
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  -H "x-airtable-api-key: YOUR_AIRTABLE_API_KEY" \
  -H "x-airtable-base-id: YOUR_BASE_ID" \
  -H "x-airtable-option-max-records: 50" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_records",
      "arguments": {
        "tableName": "YOUR_TABLE_NAME",
        "maxRecords": 10
      }
    },
    "id": 2
  }'
```

### 3. Test with Invalid Header Value
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  -H "x-airtable-api-key: YOUR_AIRTABLE_API_KEY" \
  -H "x-airtable-base-id: YOUR_BASE_ID" \
  -H "x-airtable-option-max-records: invalid" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_records",
      "arguments": {
        "tableName": "YOUR_TABLE_NAME"
      }
    },
    "id": 3
  }'
```

## Expected Results

1. **Test 1**: Should return maximum 50 records
2. **Test 2**: Should return maximum 10 records (argument overrides header)
3. **Test 3**: Should ignore invalid header value and use default behavior

## Using with MCP-Remote

When using MCP-remote with Claude Desktop, add the header to your configuration:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "connect",
        "https://your-server.com/mcp",
        "--header",
        "x-airtable-option-max-records: 100"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_auth_token"
      }
    }
  }
}
```

This will set a default limit of 100 records for all queries, which can still be overridden by specific tool arguments.