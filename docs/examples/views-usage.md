# Working with Views

This guide demonstrates how to use views in Airtable through the MCP server.

## Understanding Views

Views in Airtable are saved configurations that define:
- Which records to show (filters)
- How to sort them
- Which fields to display
- How to group or visualize data

## List Views in a Table

First, discover what views are available:

```json
{
  "tool": "list_views",
  "arguments": {
    "tableName": "Orders"
  }
}
```

**Response:**
```json
{
  "tableId": "tblORDERS123",
  "tableName": "Orders",
  "views": [
    {
      "id": "viwALL",
      "name": "All orders",
      "type": "grid"
    },
    {
      "id": "viwPENDING",
      "name": "Pending orders",
      "type": "grid"
    },
    {
      "id": "viwMONTHLY",
      "name": "Orders by month",
      "type": "calendar"
    },
    {
      "id": "viwSTATUS",
      "name": "Order pipeline",
      "type": "kanban"
    }
  ]
}
```

## Using Views with get_records

Once you know the available views, use them to filter records:

### Example 1: Get Pending Orders

```json
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Orders",
    "view": "Pending orders"
  }
}
```

This returns only the records that match the view's filter criteria.

### Example 2: Calendar View Data

```json
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Orders",
    "view": "Orders by month",
    "fields": ["OrderID", "CustomerName", "OrderDate", "Total"]
  }
}
```

### Example 3: Using View ID

```json
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Orders",
    "view": "viwSTATUS",  // Using view ID instead of name
    "maxRecords": 50
  }
}
```

## Common Patterns

### 1. Dynamic View Selection

```javascript
// List all views first
const viewsResult = await mcp.callTool('list_views', {
  tableName: 'Projects'
});

// Find specific view type
const ganttView = viewsResult.views.find(v => v.type === 'gantt');

if (ganttView) {
  // Use the Gantt view to get project timeline
  const projects = await mcp.callTool('get_records', {
    tableName: 'Projects',
    view: ganttView.id
  });
}
```

### 2. View-Based Reporting

```javascript
async function getMonthlyReport(tableName) {
  // Get all views
  const views = await mcp.callTool('list_views', { tableName });
  
  // Find reporting views (by naming convention)
  const reportViews = views.views.filter(v => 
    v.name.toLowerCase().includes('report') ||
    v.name.toLowerCase().includes('summary')
  );
  
  // Get data from each report view
  const reports = {};
  for (const view of reportViews) {
    reports[view.name] = await mcp.callTool('get_records', {
      tableName,
      view: view.id
    });
  }
  
  return reports;
}
```

### 3. View Type Detection

```javascript
// Get views grouped by type
async function getViewsByType(tableName) {
  const result = await mcp.callTool('list_views', { tableName });
  
  const viewsByType = {};
  result.views.forEach(view => {
    if (!viewsByType[view.type]) {
      viewsByType[view.type] = [];
    }
    viewsByType[view.type].push(view);
  });
  
  return viewsByType;
}

// Usage
const views = await getViewsByType('Tasks');
console.log('Grid views:', views.grid);
console.log('Kanban views:', views.kanban);
console.log('Calendar views:', views.calendar);
```

## View Types and Use Cases

### Grid Views
- Standard table layout
- Best for: General data browsing, editing multiple records

### Form Views
- Single record entry interface
- Best for: Data collection, surveys, order forms

### Calendar Views
- Date-based visualization
- Best for: Event planning, deadlines, scheduling
- Requires: Date field

### Gallery Views
- Card-based layout with images
- Best for: Product catalogs, portfolios, visual databases
- Requires: Attachment field

### Kanban Views
- Column-based workflow visualization
- Best for: Project management, status tracking, pipelines
- Requires: Single select field for columns

### Timeline Views
- Horizontal timeline display
- Best for: Project schedules, resource planning
- Requires: Date range fields

### Gantt Views
- Project timeline with dependencies
- Best for: Complex project management
- Requires: Date fields and dependencies

## Advanced Usage

### Combining Views with Filters

You can use a view and add additional filters:

```json
{
  "tool": "get_records",
  "arguments": {
    "tableName": "Orders",
    "view": "This month",
    "filterByFormula": "AND({Priority} = 'High', {Total} > 1000)",
    "sort": [{"field": "Total", "direction": "desc"}]
  }
}
```

### Paginating Through View Records

```javascript
async function getAllViewRecords(tableName, viewName) {
  const allRecords = [];
  let offset = 0;
  const pageSize = 100;
  
  while (true) {
    const result = await mcp.callTool('get_records', {
      tableName,
      view: viewName,
      maxRecords: pageSize,
      offset
    });
    
    allRecords.push(...result);
    
    if (result.length < pageSize) {
      break; // No more records
    }
    
    offset += pageSize;
  }
  
  return allRecords;
}
```

## Best Practices

1. **Use Views for Consistent Filtering**: Instead of repeating complex filterByFormula expressions, create views in Airtable
2. **Name Views Descriptively**: Use clear naming conventions like "Active Projects - 2024" or "Pending Approval - HR"
3. **Leverage View Types**: Choose the right view type for your use case
4. **Cache View Lists**: View configurations don't change often, so cache the list_views results
5. **Handle Missing Views**: Always check if a view exists before using it

## Error Handling

```javascript
try {
  // Try to use a specific view
  const records = await mcp.callTool('get_records', {
    tableName: 'Orders',
    view: 'Q4 Sales Report'
  });
} catch (error) {
  if (error.message.includes('view')) {
    // View might not exist, list available views
    const views = await mcp.callTool('list_views', {
      tableName: 'Orders'
    });
    console.log('Available views:', views.views.map(v => v.name));
  }
}
```