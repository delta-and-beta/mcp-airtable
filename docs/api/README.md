# API Reference

This section provides comprehensive documentation for all available MCP tools and their parameters.

## Available Tools

1. [list_bases](#list_bases) - List all available Airtable bases
2. [list_tables](#list_tables) - List tables in a base
3. [list_views](#list_views) - List views in a table
4. [get_records](#get_records) - Retrieve records from a table
5. [create_record](#create_record) - Create a new record
6. [update_record](#update_record) - Update an existing record
7. [delete_record](#delete_record) - Delete a record
8. [get_schema](#get_schema) - Get base schema information
9. [upload_attachment](#upload_attachment) - Upload files for attachment fields (S3 or GCS)
10. [batch_create](#batch_create) - Create multiple records efficiently
11. [batch_update](#batch_update) - Update multiple records efficiently
12. [batch_delete](#batch_delete) - Delete multiple records efficiently
13. [batch_upsert](#batch_upsert) - Create or update multiple records

## Tool Reference

### list_bases

List all available Airtable bases accessible with your API key.

**Parameters:**
- None

**Returns:**
```json
{
  "bases": [
    {
      "id": "appXXXXXXXXXXXXXX",
      "name": "Marketing Database",
      "permissionLevel": "create"
    }
  ]
}
```

**Example:**
```json
{
  "tool": "list_bases",
  "arguments": {}
}
```

---

### list_tables

List all tables in a specific Airtable base.

**Parameters:**
- `baseId` (string, optional): The base ID. Uses default if not specified.

**Returns:**
```json
{
  "tables": [
    {
      "id": "tblXXXXXXXXXXXXXX",
      "name": "Contacts",
      "description": "Customer contact information",
      "fields": [...]
    }
  ]
}
```

**Example:**
```json
{
  "tool": "list_tables",
  "arguments": {
    "baseId": "appXXXXXXXXXXXXXX"
  }
}
```

---

### list_views

List all views in a specific table.

**Parameters:**
- `tableName` (string, required): Name or ID of the table
- `baseId` (string, optional): The base ID. Uses default if not specified.

**Returns:**
```json
{
  "tableId": "tblXXXXXXXXXXXXXX",
  "tableName": "Contacts",
  "views": [
    {
      "id": "viwXXXXXXXXXXXXXX",
      "name": "All contacts",
      "type": "grid"
    },
    {
      "id": "viwYYYYYYYYYYYYYY",
      "name": "Active customers",
      "type": "grid"
    },
    {
      "id": "viwZZZZZZZZZZZZZZ",
      "name": "By status",
      "type": "kanban"
    }
  ]
}
```

**Example:**
```json
{
  "tool": "list_views",
  "arguments": {
    "tableName": "Contacts"
  }
}
```

**Example with table ID:**
```json
{
  "tool": "list_views",
  "arguments": {
    "tableName": "tblXXXXXXXXXXXXXX",
    "baseId": "appXXXXXXXXXXXXXX"
  }
}
```

**View Types:**
- `grid` - Standard table view
- `form` - Form view for data entry
- `calendar` - Calendar view (requires date field)
- `gallery` - Gallery view (requires attachment field)
- `kanban` - Kanban board view (requires single select field)
- `timeline` - Timeline view (requires date range)
- `gantt` - Gantt chart view

**Using Views with get_records:**
After listing views, you can use a view ID or name with `get_records`:
```json
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Contacts",
    "view": "Active customers"  // or "viwYYYYYYYYYYYYYY"
  }
}
```

---

### get_records

Retrieve records from a table with optional filtering and sorting.

**Parameters:**
- `tableName` (string, required): Name of the table
- `baseId` (string, optional): The base ID
- `view` (string, optional): Name or ID of a view to use
- `maxRecords` (number, optional): Maximum records to return (1-100)
- `filterByFormula` (string, optional): Airtable formula for filtering
- `sort` (array, optional): Sort configuration
  - `field` (string): Field name to sort by
  - `direction` (string, optional): 'asc' or 'desc'
- `fields` (array, optional): List of field names to return

**Returns:**
```json
[
  {
    "id": "recXXXXXXXXXXXXXX",
    "fields": {
      "Name": "John Doe",
      "Email": "john@example.com"
    },
    "createdTime": "2024-01-01T00:00:00.000Z"
  }
]
```

**Example:**
```json
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Contacts",
    "maxRecords": 10,
    "filterByFormula": "AND({Status} = 'Active', {Score} > 50)",
    "sort": [{"field": "Name", "direction": "asc"}],
    "fields": ["Name", "Email", "Status"]
  }
}
```

---

### create_record

Create a new record in a table.

**Parameters:**
- `tableName` (string, required): Name of the table
- `fields` (object, required): Field values for the new record
- `baseId` (string, optional): The base ID
- `typecast` (boolean, optional): Automatically convert string values to their proper field types

**Returns:**
```json
{
  "id": "recXXXXXXXXXXXXXX",
  "fields": {
    "Name": "Jane Smith",
    "Email": "jane@example.com"
  },
  "createdTime": "2024-01-01T00:00:00.000Z"
}
```

**Example:**
```json
{
  "tool": "create_record",
  "arguments": {
    "tableName": "Contacts",
    "fields": {
      "Name": "Jane Smith",
      "Email": "jane@example.com",
      "Status": "Active",
      "Tags": ["customer", "vip"]
    }
  }
}
```

**Example with typecast:**
```json
{
  "tool": "create_record",
  "arguments": {
    "tableName": "Products",
    "fields": {
      "Name": "Widget",
      "Price": "49.99",  // String will be converted to number
      "InStock": "true", // String will be converted to boolean
      "Quantity": "100"  // String will be converted to number
    },
    "typecast": true
  }
}
```

---

### update_record

Update an existing record.

**Parameters:**
- `tableName` (string, required): Name of the table
- `recordId` (string, required): ID of the record to update
- `fields` (object, required): Field values to update
- `baseId` (string, optional): The base ID
- `typecast` (boolean, optional): Automatically convert string values to their proper field types

**Returns:**
```json
{
  "id": "recXXXXXXXXXXXXXX",
  "fields": {
    "Name": "Jane Smith",
    "Email": "jane.smith@example.com",
    "Status": "Inactive"
  },
  "createdTime": "2024-01-01T00:00:00.000Z"
}
```

**Example:**
```json
{
  "tool": "update_record",
  "arguments": {
    "tableName": "Contacts",
    "recordId": "recXXXXXXXXXXXXXX",
    "fields": {
      "Email": "jane.smith@example.com",
      "Status": "Inactive"
    }
  }
}
```

---

### delete_record

Delete a record from a table.

**Parameters:**
- `tableName` (string, required): Name of the table
- `recordId` (string, required): ID of the record to delete
- `baseId` (string, optional): The base ID

**Returns:**
```json
{
  "id": "recXXXXXXXXXXXXXX",
  "deleted": true
}
```

**Example:**
```json
{
  "tool": "delete_record",
  "arguments": {
    "tableName": "Contacts",
    "recordId": "recXXXXXXXXXXXXXX"
  }
}
```

---

### get_schema

Get the complete schema information for a base.

**Parameters:**
- `baseId` (string, optional): The base ID

**Returns:**
```json
{
  "tables": [
    {
      "id": "tblXXXXXXXXXXXXXX",
      "name": "Contacts",
      "fields": [
        {
          "id": "fldXXXXXXXXXXXXXX",
          "name": "Name",
          "type": "singleLineText"
        }
      ]
    }
  ]
}
```

**Example:**
```json
{
  "tool": "get_schema",
  "arguments": {
    "baseId": "appXXXXXXXXXXXXXX"
  }
}
```

---

### upload_attachment

Upload a file to cloud storage (S3 or Google Cloud Storage) and get a URL for use in Airtable attachment fields.

**Requirements:**
- Either AWS S3 or Google Cloud Storage must be configured (see [Configuration Guide](../guides/configuration.md))

**Parameters:**
- `filePath` (string, optional): Local file path to upload
- `base64Data` (string, optional): Base64 encoded file data
- `filename` (string, required with base64Data): Filename for the attachment
- `contentType` (string, optional): MIME type of the file
- `storage` (string, optional): Storage provider - 'auto', 's3', or 'gcs' (default: 'auto')

**Returns:**
```json
{
  "url": "https://storage.googleapis.com/your-bucket/attachments/1234567890-image.jpg",
  "filename": "image.jpg",
  "size": 102400,
  "type": "image/jpeg",
  "storage": "gcs"  // or "s3"
}
```

**Example with file path:**
```json
{
  "tool": "upload_attachment",
  "arguments": {
    "filePath": "/path/to/image.jpg",
    "contentType": "image/jpeg"
  }
}
```

**Example with base64 data:**
```json
{
  "tool": "upload_attachment",
  "arguments": {
    "base64Data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "filename": "pixel.png",
    "contentType": "image/png"
  }
}
```

**Example forcing specific storage:**
```json
{
  "tool": "upload_attachment",
  "arguments": {
    "filePath": "/path/to/document.pdf",
    "storage": "gcs"  // Force Google Cloud Storage
  }
}
```

**Using with create_record:**
```json
{
  "tool": "create_record",
  "arguments": {
    "tableName": "Products",
    "fields": {
      "Name": "Example Product",
      "Images": [
        {
          "url": "https://your-bucket.s3.amazonaws.com/attachments/1234567890-image.jpg",
          "filename": "product-image.jpg"
        }
      ]
    }
  }
}
```

## Error Responses

All tools return consistent error responses:

```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {} // Only in development mode
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_ERROR`: Authentication required or failed
- `RATE_LIMIT_ERROR`: API rate limit exceeded
- `AIRTABLE_ERROR`: Airtable API error
- `INTERNAL_ERROR`: Server error

## Rate Limiting

The server respects Airtable's rate limit of 5 requests per second per base. If you exceed this limit, you'll receive a `RATE_LIMIT_ERROR` and should retry after a short delay.

## Field Types

Airtable supports various field types. Here's how to format them:

- **Text**: `"Simple text"`
- **Number**: `123.45`
- **Select**: `"Option 1"`
- **Multiple Select**: `["Option 1", "Option 2"]`
- **Date**: `"2024-01-01"`
- **DateTime**: `"2024-01-01T12:00:00.000Z"`
- **Checkbox**: `true` or `false`
- **Attachments**: `[{"url": "https://...", "filename": "file.jpg"}]`
- **Linked Records**: `["recXXXXXXXXXXXXXX", "recYYYYYYYYYYYYYY"]`

---

### batch_create

Create multiple records efficiently with automatic batching and queue support.

**Features:**
- Automatically chunks large batches (Airtable limit: 10 records per API call)
- Intelligent rate limiting (5 requests/second)
- Redis queue support for high-volume operations
- Automatic retry with exponential backoff

**Parameters:**
- `tableName` (string, required): Name of the table
- `records` (array, required): Array of records to create (1-1000 records)
  - `fields` (object, required): Field values for the record
- `baseId` (string, optional): The base ID
- `typecast` (boolean, optional): Automatically convert string values to their proper field types

**Returns:**
```json
[
  {
    "id": "recXXXXXXXXXXXXXX",
    "fields": { /* record data */ },
    "createdTime": "2024-01-01T00:00:00.000Z"
  },
  // ... more records
]
```

**Example - Small batch (≤10 records):**
```json
{
  "tool": "batch_create",
  "arguments": {
    "tableName": "Orders",
    "records": [
      {
        "fields": {
          "OrderID": "ORD-001",
          "Customer": "John Doe",
          "Total": 299.99,
          "Status": "Pending"
        }
      },
      {
        "fields": {
          "OrderID": "ORD-002",
          "Customer": "Jane Smith",
          "Total": 599.99,
          "Status": "Processing"
        }
      }
    ],
    "typecast": true
  }
}
```

**Example - Large batch (>10 records, auto-chunked):**
```json
{
  "tool": "batch_create",
  "arguments": {
    "tableName": "Inventory",
    "records": [
      // This will be automatically processed in chunks
      { "fields": { "SKU": "ITEM-001", "Quantity": 100 } },
      { "fields": { "SKU": "ITEM-002", "Quantity": 200 } },
      // ... up to 1000 records
      { "fields": { "SKU": "ITEM-999", "Quantity": 50 } }
    ],
    "typecast": true
  }
}
```

**Performance Notes:**
- Records > 10: Automatically batched and queued
- With Redis: Distributed queue processing
- Without Redis: In-memory queue with rate limiting
- Failed chunks are retried up to 3 times

---

### batch_update

Update multiple records efficiently with automatic batching and queue support.

**Features:**
- Same performance features as batch_create
- Updates only specified fields (partial updates)
- Preserves existing field values not included in update

**Parameters:**
- `tableName` (string, required): Name of the table
- `records` (array, required): Array of records to update (1-1000 records)
  - `id` (string, required): Record ID to update
  - `fields` (object, required): Field values to update
- `baseId` (string, optional): The base ID
- `typecast` (boolean, optional): Automatically convert string values to their proper field types

**Returns:**
```json
[
  {
    "id": "recXXXXXXXXXXXXXX",
    "fields": { /* updated record data */ },
    "createdTime": "2024-01-01T00:00:00.000Z"
  },
  // ... more records
]
```

**Example - Update multiple records:**
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
          "TrackingNumber": "TRK-12345"
        }
      },
      {
        "id": "recDEF987654321",
        "fields": {
          "Status": "Delivered",
          "DeliveryDate": "2024-01-15"
        }
      }
    ],
    "typecast": true
  }
}
```

**Example - Mass status update:**
```json
{
  "tool": "batch_update",
  "arguments": {
    "tableName": "Customers",
    "records": [
      // Update subscription status for multiple customers
      { "id": "rec001", "fields": { "SubscriptionStatus": "Active", "RenewalDate": "2025-01-01" } },
      { "id": "rec002", "fields": { "SubscriptionStatus": "Active", "RenewalDate": "2025-01-01" } },
      // ... can handle up to 1000 records
      { "id": "rec999", "fields": { "SubscriptionStatus": "Active", "RenewalDate": "2025-01-01" } }
    ]
  }
}
```

**Queue Configuration:**

When Redis is configured, batch operations use distributed queuing:

```bash
# Environment variables for Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
QUEUE_CONCURRENCY=5  # Number of concurrent workers
```

Without Redis, operations use an in-memory queue with automatic rate limiting.

---

### batch_delete

Delete multiple records efficiently with automatic batching and queue support.

**Features:**
- Automatically chunks large batches (Airtable limit: 10 records per API call)
- Intelligent rate limiting (5 requests/second)
- Redis queue support for high-volume operations
- Automatic retry with exponential backoff

**Parameters:**
- `tableName` (string, required): Name of the table
- `recordIds` (array, required): Array of record IDs to delete (1-1000 records)
- `baseId` (string, optional): The base ID

**Returns:**
```json
[
  {
    "id": "recXXXXXXXXXXXXXX",
    "deleted": true
  },
  // ... more records
]
```

**Example - Delete specific records:**
```json
{
  "tool": "batch_delete",
  "arguments": {
    "tableName": "OldRecords",
    "recordIds": [
      "recABC123456789",
      "recDEF987654321",
      "recGHI456789123"
    ]
  }
}
```

**Example - Mass cleanup (100+ records):**
```json
{
  "tool": "batch_delete",
  "arguments": {
    "tableName": "TempData",
    "recordIds": [
      // Auto-chunked into batches of 10
      "rec001", "rec002", "rec003", // ... up to 1000 records
    ]
  }
}
```

**Example - Delete with specific base:**
```json
{
  "tool": "batch_delete",
  "arguments": {
    "tableName": "ArchivedItems",
    "baseId": "appXXXXXXXXXXXXXX",
    "recordIds": [
      "recOLD001",
      "recOLD002",
      "recOLD003"
    ]
  }
}
```

**Performance Notes:**
- Same batching and queueing as batch_create/update
- With Redis: Distributed deletion across workers
- Without Redis: Sequential processing with rate limiting
- Deleted records cannot be recovered

**Common Use Cases:**
1. **Cleanup old data**: Delete records older than X days
2. **Remove duplicates**: Delete duplicate entries after deduplication
3. **Archive and delete**: After exporting to archive, delete from active base
4. **Test data cleanup**: Remove test records in bulk

---

### batch_upsert

Create or update multiple records in a single operation. Supports intelligent field matching for updates.

**Parameters:**
- `tableName` (string, required): Name of the table
- `records` (array, required): Array of records to upsert (1-100 records)
  - `fields` (object, required): Field values for the record
  - `id` (string, optional): Record ID for updates
- `baseId` (string, optional): The base ID
- `typecast` (boolean, optional): Automatically convert string values to their proper field types
- `upsertFields` (array, optional): Fields to use for matching existing records
- `detectUpsertFields` (boolean, optional): Use AI to automatically detect unique fields for matching

**Returns:**
```json
[
  {
    "id": "recXXXXXXXXXXXXXX",
    "fields": { /* record data */ },
    "createdTime": "2024-01-01T00:00:00.000Z"
  },
  // ... more records
]
```

**Example - Basic batch create:**
```json
{
  "tool": "batch_upsert",
  "arguments": {
    "tableName": "Products",
    "records": [
      {
        "fields": {
          "SKU": "WIDGET-001",
          "Name": "Blue Widget",
          "Price": 29.99
        }
      },
      {
        "fields": {
          "SKU": "WIDGET-002",
          "Name": "Red Widget",
          "Price": 34.99
        }
      }
    ],
    "typecast": true
  }
}
```

**Example - Upsert with manual field specification:**
```json
{
  "tool": "batch_upsert",
  "arguments": {
    "tableName": "Inventory",
    "records": [
      {
        "fields": {
          "SKU": "PROD-123",
          "Quantity": 150,
          "LastUpdated": "2024-01-15"
        }
      },
      {
        "fields": {
          "SKU": "PROD-456",
          "Quantity": 75,
          "LastUpdated": "2024-01-15"
        }
      }
    ],
    "upsertFields": ["SKU"],  // Use SKU to match existing records
    "typecast": true
  }
}
```

**Example - AI-powered upsert field detection:**
```json
{
  "tool": "batch_upsert",
  "arguments": {
    "tableName": "Customers",
    "records": [
      {
        "fields": {
          "Email": "john@example.com",
          "Name": "John Doe",
          "LastPurchase": "2024-01-10",
          "TotalSpent": 599.99
        }
      },
      {
        "fields": {
          "Email": "jane@example.com",
          "Name": "Jane Smith",
          "LastPurchase": "2024-01-12",
          "TotalSpent": 1299.50
        }
      }
    ],
    "detectUpsertFields": true,  // AI will detect that Email is the unique identifier
    "typecast": true
  }
}
```

**How AI Detection Works:**

The AI analyzes your records to find the best fields for matching:
1. **Uniqueness**: Fields with unique values across all records
2. **Field names**: Prioritizes fields named "id", "key", "code", "sku", "email", etc.
3. **Field types**: Prefers autoNumber, barcode fields
4. **Value patterns**: Recognizes IDs, emails, alphanumeric codes
5. **Combinations**: Can suggest multiple fields if needed

**Batch Limits:**
- Maximum 100 records per request
- Records are processed in chunks of 10 (Airtable API limit)
- Rate limiting applies (5 requests/second per base)