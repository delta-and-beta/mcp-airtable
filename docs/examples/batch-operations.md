# Batch Operations Examples

This guide demonstrates how to use the batch operations effectively with the MCP Airtable server.

## Overview

The MCP Airtable server provides four batch operations:
- `batch_create` - Create multiple records efficiently
- `batch_update` - Update multiple records efficiently
- `batch_delete` - Delete multiple records efficiently  
- `batch_upsert` - Create or update records based on matching fields

All batch operations feature:
- Automatic chunking (Airtable's 10-record limit per API call)
- Intelligent rate limiting (5 requests/second)
- Redis queue support for high-volume operations
- Automatic retry with exponential backoff

## Batch Create Examples

### Import Product Catalog

```json
{
  "tool": "batch_create",
  "arguments": {
    "tableName": "Products",
    "records": [
      {
        "fields": {
          "SKU": "LAPTOP-001",
          "Name": "Professional Laptop",
          "Category": "Electronics",
          "Price": 1299.99,
          "Stock": 25,
          "Description": "High-performance laptop for professionals"
        }
      },
      {
        "fields": {
          "SKU": "MOUSE-001",
          "Name": "Wireless Mouse",
          "Category": "Accessories",
          "Price": 49.99,
          "Stock": 150,
          "Description": "Ergonomic wireless mouse"
        }
      },
      {
        "fields": {
          "SKU": "KEYBOARD-001",
          "Name": "Mechanical Keyboard",
          "Category": "Accessories",
          "Price": 129.99,
          "Stock": 75,
          "Description": "RGB mechanical keyboard"
        }
      }
    ],
    "typecast": true
  }
}
```

### Bulk Customer Import

```json
{
  "tool": "batch_create",
  "arguments": {
    "tableName": "Customers",
    "records": [
      // This example shows importing 50+ customers
      // The server will automatically chunk into batches of 10
      {
        "fields": {
          "Email": "customer1@example.com",
          "FirstName": "John",
          "LastName": "Doe",
          "Company": "Acme Corp",
          "SubscriptionTier": "Premium",
          "SignupDate": "2024-01-15"
        }
      },
      // ... more customers ...
      {
        "fields": {
          "Email": "customer50@example.com",
          "FirstName": "Jane",
          "LastName": "Smith",
          "Company": "Tech Solutions",
          "SubscriptionTier": "Basic",
          "SignupDate": "2024-01-20"
        }
      }
    ],
    "typecast": true
  }
}
```

## Batch Update Examples

### Update Order Statuses

```json
{
  "tool": "batch_update",
  "arguments": {
    "tableName": "Orders",
    "records": [
      {
        "id": "recABC123456789",
        "fields": {
          "Status": "Shipped",
          "ShippedDate": "2024-01-15",
          "TrackingNumber": "TRK-12345",
          "Carrier": "FedEx"
        }
      },
      {
        "id": "recDEF987654321",
        "fields": {
          "Status": "Shipped",
          "ShippedDate": "2024-01-15",
          "TrackingNumber": "TRK-12346",
          "Carrier": "UPS"
        }
      },
      {
        "id": "recGHI456789123",
        "fields": {
          "Status": "Processing",
          "EstimatedShipDate": "2024-01-16"
        }
      }
    ],
    "typecast": true
  }
}
```

### Mass Price Update

```json
{
  "tool": "batch_update",
  "arguments": {
    "tableName": "Products",
    "records": [
      // Apply 10% discount to multiple products
      { "id": "recPROD001", "fields": { "Price": 89.99, "OnSale": true } },
      { "id": "recPROD002", "fields": { "Price": 179.99, "OnSale": true } },
      { "id": "recPROD003", "fields": { "Price": 44.99, "OnSale": true } },
      { "id": "recPROD004", "fields": { "Price": 269.99, "OnSale": true } },
      { "id": "recPROD005", "fields": { "Price": 134.99, "OnSale": true } }
    ]
  }
}
```

## Batch Delete Examples

### Delete Inactive Records

```json
{
  "tool": "batch_delete",
  "arguments": {
    "tableName": "Customers",
    "recordIds": [
      "recINACTIVE001",
      "recINACTIVE002",
      "recINACTIVE003",
      "recINACTIVE004",
      "recINACTIVE005"
    ]
  }
}
```

### Mass Cleanup After Export

```javascript
// First, get records to archive
const oldOrders = await mcp.callTool('get_records', {
  tableName: 'Orders',
  filterByFormula: 'IS_BEFORE({Date}, DATEADD(TODAY(), -90, "days"))',
  maxRecords: 100
});

// Export to archive (your logic here)
await exportToArchive(oldOrders);

// Then batch delete
const recordIds = oldOrders.map(order => order.id);
await mcp.callTool('batch_delete', {
  tableName: 'Orders',
  recordIds: recordIds
});
```

### Delete Test Data

```json
{
  "tool": "batch_delete",
  "arguments": {
    "tableName": "Products",
    "recordIds": [
      // Delete all test records
      "recTEST001", "recTEST002", "recTEST003", "recTEST004", "recTEST005",
      "recTEST006", "recTEST007", "recTEST008", "recTEST009", "recTEST010",
      // ... this will be auto-chunked
      "recTEST095", "recTEST096", "recTEST097", "recTEST098", "recTEST099"
    ]
  }
}
```

## Batch Upsert Examples

### Sync Inventory from External System

```json
{
  "tool": "batch_upsert",
  "arguments": {
    "tableName": "Inventory",
    "records": [
      {
        "fields": {
          "SKU": "WIDGET-001",
          "WarehouseLocation": "A1-B2",
          "Quantity": 500,
          "LastCountDate": "2024-01-15",
          "ReorderPoint": 100
        }
      },
      {
        "fields": {
          "SKU": "GADGET-002",
          "WarehouseLocation": "C3-D4",
          "Quantity": 250,
          "LastCountDate": "2024-01-15",
          "ReorderPoint": 50
        }
      }
    ],
    "upsertFields": ["SKU"],  // Match on SKU field
    "typecast": true
  }
}
```

### Customer Data Sync with AI Detection

```json
{
  "tool": "batch_upsert",
  "arguments": {
    "tableName": "Customers",
    "records": [
      {
        "fields": {
          "Email": "john.doe@company.com",
          "FirstName": "John",
          "LastName": "Doe",
          "TotalPurchases": 5,
          "LifetimeValue": 2499.95,
          "LastPurchaseDate": "2024-01-10",
          "LoyaltyPoints": 250
        }
      },
      {
        "fields": {
          "Email": "jane.smith@business.com",
          "FirstName": "Jane",
          "LastName": "Smith",
          "TotalPurchases": 12,
          "LifetimeValue": 5999.88,
          "LastPurchaseDate": "2024-01-12",
          "LoyaltyPoints": 600
        }
      }
    ],
    "detectUpsertFields": true,  // AI will detect Email as unique field
    "typecast": true
  }
}
```

## Performance Optimization

### Large Batch Import (100+ records)

When importing large datasets, the server automatically handles:

```json
{
  "tool": "batch_create",
  "arguments": {
    "tableName": "TransactionLog",
    "records": [
      // 500 transaction records
      { "fields": { "TransactionID": "TXN-001", "Amount": 100.00, "Date": "2024-01-01" } },
      { "fields": { "TransactionID": "TXN-002", "Amount": 250.50, "Date": "2024-01-01" } },
      // ... 498 more records ...
      { "fields": { "TransactionID": "TXN-500", "Amount": 75.25, "Date": "2024-01-15" } }
    ]
  }
}
```

**What happens behind the scenes:**
1. Records are chunked into groups of 10
2. Each chunk is queued (Redis) or processed sequentially (in-memory)
3. Rate limiting ensures 5 requests/second max
4. Failed chunks retry up to 3 times with exponential backoff
5. All results are collected and returned together

### With Redis Queue

When Redis is configured, you get additional benefits:

```bash
# Multiple instances can process the queue
REDIS_HOST=redis.example.com
REDIS_PORT=6379
QUEUE_CONCURRENCY=10  # Process 10 chunks in parallel
```

This allows:
- Processing 50 records/second (10 workers × 5 req/sec)
- Distributed processing across multiple servers
- Queue persistence (survives crashes)
- Better error recovery

## Error Handling

### Partial Failures

If some records fail, the response indicates which succeeded:

```json
{
  "results": [
    { "id": "rec123", "fields": { /* ... */ }, "createdTime": "..." },
    { "error": "Invalid field type", "record": { /* original data */ } },
    { "id": "rec456", "fields": { /* ... */ }, "createdTime": "..." }
  ]
}
```

### Retry Logic

Failed operations are automatically retried:
- 1st retry: After 2 seconds
- 2nd retry: After 4 seconds  
- 3rd retry: After 8 seconds

## Best Practices

1. **Use typecast for data consistency**
   ```json
   "typecast": true  // Converts "100" → 100, "true" → true
   ```

2. **Batch similar operations**
   - Group creates together
   - Group updates together
   - Don't mix different table operations

3. **For upserts, prefer explicit field specification**
   ```json
   "upsertFields": ["Email"]  // More reliable than AI detection
   ```

4. **Monitor queue size with large batches**
   - Check Redis queue length
   - Adjust QUEUE_CONCURRENCY if needed

5. **Use appropriate batch sizes**
   - 10-100 records: Good for real-time processing
   - 100-1000 records: Use with Redis for best performance
   - 1000+ records: Consider splitting into multiple requests

## Common Patterns

### Daily Data Sync

```javascript
// Sync customer data from external system
async function syncCustomers(customers) {
  const batches = [];
  
  // Split into 1000-record batches
  for (let i = 0; i < customers.length; i += 1000) {
    batches.push(customers.slice(i, i + 1000));
  }
  
  // Process each batch
  for (const batch of batches) {
    await mcp.callTool('batch_upsert', {
      tableName: 'Customers',
      records: batch.map(c => ({
        fields: {
          CustomerID: c.id,
          Email: c.email,
          // ... other fields
        }
      })),
      upsertFields: ['CustomerID'],
      typecast: true
    });
  }
}
```

### Bulk Status Updates

```javascript
// Update all orders from yesterday to "shipped"
async function shipYesterdaysOrders() {
  // First, get orders to ship
  const orders = await mcp.callTool('get_records', {
    tableName: 'Orders',
    filterByFormula: 'AND({Status} = "Ready", {Date} = YESTERDAY())',
    maxRecords: 100
  });
  
  // Prepare batch update
  const updates = orders.map(order => ({
    id: order.id,
    fields: {
      Status: 'Shipped',
      ShippedDate: new Date().toISOString()
    }
  }));
  
  // Execute batch update
  await mcp.callTool('batch_update', {
    tableName: 'Orders',
    records: updates
  });
}
```