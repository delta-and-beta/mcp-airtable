# Examples and Use Cases

This section provides real-world examples of using the MCP Airtable server for various use cases.

## Table of Contents

1. [Basic Operations](#basic-operations)
2. [CRM System](#crm-system)
3. [Inventory Management](#inventory-management)
4. [Content Management](#content-management)
5. [Project Tracking](#project-tracking)
6. [Data Migration](#data-migration)
7. [Automation Workflows](#automation-workflows)

## Basic Operations

### Creating Records

```
# Simple record
Create a new contact with Name "Jane Smith" and Email "jane@example.com"

# Record with multiple fields
Create a product with:
- Name: "Premium Widget"
- SKU: "WID-001"
- Price: 49.99
- Category: "Hardware"
- In Stock: true
```

### Reading Records

```
# Get all records
Show me all records from the Contacts table

# With filtering
Get contacts where Status equals "Active" and Score is greater than 80

# With sorting
Get products sorted by Price descending, limit to 10
```

### Updating Records

```
# Update single field
Update record rec123456 in Contacts table, set Status to "Inactive"

# Update multiple fields
Update product SKU-001 with:
- Price: 39.99
- On Sale: true
- Discount: 20
```

### Deleting Records

```
# Delete by ID
Delete record rec789012 from the Orders table

# Bulk delete (with caution)
Find all contacts where "Last Activity" is before 2020-01-01 and delete them
```

## CRM System

### Contact Management

```
# Add a new lead
Create a contact with:
- Name: "John Doe"
- Company: "Acme Corp"
- Email: "john@acme.com"
- Phone: "+1-555-0123"
- Status: "Lead"
- Source: "Website"
- Tags: ["Hot Lead", "Enterprise"]

# Update lead status
Find contact with email "john@acme.com" and update:
- Status: "Qualified"
- Assigned To: "Sales Team"
- Next Action: "Schedule Demo"

# Track interactions
Create an interaction record:
- Contact: [Link to John Doe]
- Type: "Email"
- Date: Today
- Notes: "Discussed pricing options"
- Follow Up: 3 days from now
```

### Sales Pipeline

```
# View pipeline
Get all opportunities where Stage is not "Closed" grouped by Stage

# Move deal forward
Update opportunity "Acme Corp Deal" with:
- Stage: "Negotiation"
- Probability: 75
- Updated: Today

# Calculate metrics
Get all opportunities where "Close Date" is this month and Status is "Won"
Sum the Deal Value field
```

### Customer Analytics

```
# Segment customers
Find all contacts where:
- Total Purchase Value > 10000
- Last Purchase Date > 6 months ago
Tag them as "VIP Retention Risk"

# Activity tracking
Get all interactions for Contact "rec123456" in the last 30 days
Sort by Date descending
```

## Inventory Management

### Stock Control

```
# Low stock alert
Find all products where:
- Stock Level < Reorder Point
- Status = "Active"

# Update stock after sale
Decrease stock for SKU-12345 by 5 units
If stock level < 10, set "Low Stock" flag to true

# Bulk inventory update
For each product in the "Electronics" category:
- If stock > 100, set Storage Location to "Warehouse A"
- If stock < 20, set Priority Reorder to true
```

### Product Catalog

```
# Add product variant
Create a product:
- Name: "T-Shirt"
- Base SKU: "TSH-001"
- Variants: [
    {Size: "S", Color: "Blue", SKU: "TSH-001-S-BLU"},
    {Size: "M", Color: "Blue", SKU: "TSH-001-M-BLU"},
    {Size: "L", Color: "Blue", SKU: "TSH-001-L-BLU"}
  ]

# Update pricing
For all products in category "Summer Sale":
- Calculate: Sale Price = Price * 0.8
- Set "On Sale" to true
- Set "Sale Ends" to "2024-08-31"
```

### Supplier Management

```
# Track orders
Create purchase order:
- Supplier: "Global Supplies Inc"
- Items: [Link to products needing reorder]
- Order Date: Today
- Expected Delivery: 14 days
- Status: "Pending"

# Update on receipt
Update PO-12345:
- Status: "Received"
- Actual Delivery: Today
For each item in the order:
- Increase stock by ordered quantity
```

## Content Management

### Editorial Calendar

```
# Schedule content
Create blog post:
- Title: "10 Tips for Better Productivity"
- Author: "Jane Writer"
- Status: "Draft"
- Category: "Productivity"
- Scheduled Date: Next Monday
- Tags: ["Tips", "Productivity", "Featured"]

# Content pipeline
Get all posts where:
- Status = "Ready for Review"
- Scheduled Date < 7 days from now
Sort by Scheduled Date

# Publish content
Update post "10 Tips for Better Productivity":
- Status: "Published"
- Published Date: Now
- URL: "https://blog.example.com/10-tips-productivity"
```

### Media Library

```
# Upload and catalog media
Upload image "hero-banner.jpg" and create media record:
- File: [Attachment]
- Title: "Homepage Hero Banner"
- Type: "Image"
- Usage Rights: "Purchased"
- Tags: ["Homepage", "Banner", "2024"]

# Find media
Search media where:
- Type = "Image"
- Tags contains "Banner"
- Created > 30 days ago
```

### Content Performance

```
# Track metrics
Update post "10 Tips" with analytics:
- Views: 5432
- Shares: 234
- Comments: 45
- Engagement Rate: 8.5%

# Performance report
Get all posts where:
- Published Date > Start of month
- Status = "Published"
Calculate average Views and Engagement Rate
```

## Project Tracking

### Task Management

```
# Create project tasks
Create task:
- Project: "Website Redesign"
- Title: "Design Homepage Mockup"
- Assignee: "Design Team"
- Priority: "High"
- Due Date: 5 days from now
- Status: "To Do"
- Estimated Hours: 16

# Update progress
Find task "Design Homepage Mockup" and update:
- Status: "In Progress"
- Progress: 50
- Actual Hours: 8
- Comments: "First draft complete, awaiting feedback"

# Team workload
Get all tasks where:
- Assignee = "John Developer"
- Status in ["To Do", "In Progress"]
- Due Date < 14 days
Sort by Priority and Due Date
```

### Sprint Planning

```
# Create sprint
Create sprint record:
- Name: "Sprint 24"
- Start Date: Next Monday
- End Date: 2 weeks from Monday
- Goals: "Complete user authentication and profile pages"

# Assign tasks to sprint
Update tasks where Label contains "Authentication":
- Sprint: "Sprint 24"
- Status: "Ready"

# Sprint progress
Get all tasks where Sprint = "Sprint 24"
Group by Status
Calculate story points completed vs total
```

### Resource Planning

```
# Capacity planning
For each team member:
- Sum Estimated Hours for tasks in current sprint
- Compare to Available Hours
- Flag if overallocated

# Timeline view
Get all tasks for "Website Redesign" project
Where Status != "Done"
Sort by Due Date
Check for scheduling conflicts
```

## Batch Operations

### Bulk Import with Typecast

```
# Import products with automatic type conversion
Batch upsert to Products table:
- SKU: "PROD-001", Name: "Widget A", Price: "29.99", InStock: "true"
- SKU: "PROD-002", Name: "Widget B", Price: "39.99", InStock: "false"
- SKU: "PROD-003", Name: "Widget C", Price: "49.99", InStock: "true"
With typecast enabled and use SKU as the unique identifier

# The system will:
1. Convert Price from string to number
2. Convert InStock from string to boolean
3. Update existing products with matching SKU
4. Create new products if SKU doesn't exist
```

### Smart Deduplication

```
# Import contacts with AI-detected unique fields
Batch upsert these contacts and let AI detect the unique identifier:
[
  {Email: "john@example.com", Name: "John Doe", Company: "Acme Corp"},
  {Email: "jane@example.com", Name: "Jane Smith", Company: "Tech Inc"},
  {Email: "john@example.com", Name: "John D.", Company: "Acme Corporation"}
]

# AI will detect Email as the unique field and update the duplicate
```

### Inventory Synchronization

```
# Sync inventory from external system
Batch upsert to Inventory table:
Records: [Load from inventory.json]
Use fields: ["WarehouseID", "SKU"] for matching
Enable typecast for quantity conversions

# This creates a composite key from WarehouseID + SKU
```

## Data Migration

### Import from CSV

```
# Bulk import customers
For each row in customer_data.csv:
  Create contact with:
  - Name: [Column A]
  - Email: [Column B]
  - Phone: [Column C]
  - Company: [Column D]
  - Imported Date: Today
  - Source: "Legacy System"

# Data validation
After import, find records where:
- Email is empty OR
- Phone doesn't match format OR
- Company is "Unknown"
Tag as "Needs Review"
```

### Export Operations

```
# Export for analysis
Get all orders where:
- Order Date >= Start of Quarter
- Status = "Completed"
Include fields: Order ID, Customer, Total, Date, Products
Format for Excel export

# Backup critical data
Get all records from Customers table
Include all fields
Add export timestamp
```

### Data Cleanup

```
# Remove duplicates
Find contacts with duplicate emails
For each duplicate set:
- Keep record with most recent activity
- Merge important fields
- Delete other records

# Standardize data
Update all contacts:
- Trim whitespace from Name and Email
- Format Phone as "+1-XXX-XXX-XXXX"
- Capitalize first letter of Status
```

## Automation Workflows

### Order Processing

```
# When new order created:
1. Check inventory for each item
2. If all items in stock:
   - Update order status to "Processing"
   - Decrease inventory counts
   - Create shipping record
3. If any item out of stock:
   - Update order status to "Pending"
   - Create restock task
   - Notify customer of delay

# Shipping updates
When tracking number added to shipping record:
- Update order status to "Shipped"
- Send email to customer with tracking
- Schedule follow-up for 7 days
```

### Customer Onboarding

```
# New customer workflow
When contact Status changes to "Customer":
1. Create welcome task for account manager
2. Add to "New Customers" email list
3. Schedule check-in call for 1 week
4. Create onboarding checklist
5. Set up billing record

# Follow-up automation
Find customers where:
- Signup Date = 30 days ago
- No purchases yet
Create task: "Re-engagement outreach"
```

### Reporting Automation

```
# Weekly sales report
Every Monday at 9 AM:
1. Get all orders from past week
2. Calculate:
   - Total revenue
   - Number of orders
   - Average order value
   - Top selling products
3. Create report record with metrics
4. Notify sales team

# Monthly inventory check
First day of month:
1. Get all products
2. Flag items below reorder point
3. Calculate inventory value
4. Identify slow-moving stock
5. Create inventory report
```

## Advanced Patterns

### Batch Operations

```
# Efficient bulk updates
// Instead of updating one by one:
Get first 100 products where needs_update = true
For each batch of 10:
  Update with new pricing formula
  Mark as updated
  Wait 2 seconds (respect rate limits)
```

### Complex Filtering

```
# Multi-condition search
Find orders where:
  (Status = "Pending" AND Created > 7 days ago) OR
  (Status = "Processing" AND Priority = "High") OR
  (Customer Type = "VIP" AND Total > 1000)
Sort by Priority desc, Created asc
```

### Related Data

```
# Working with linked records
Get customer "Acme Corp"
Then get all linked:
- Orders (sort by date desc)
- Support tickets (filter by open)
- Contacts (filter by active)
Create summary view
```

## Tips for Complex Operations

1. **Break down complex operations** into smaller steps
2. **Use views** in Airtable to pre-filter data
3. **Respect rate limits** with delays in bulk operations
4. **Test with small datasets** before running on all records
5. **Keep audit trails** by adding "Modified Date" and "Modified By" fields
6. **Use formula fields** in Airtable for complex calculations
7. **Leverage linked records** for relational data

## Integration Examples

### With Other Tools

```
# Slack notification
When high-priority ticket created:
- Get ticket details
- Format message
- Send to #support channel

# Email automation
For customers with birthday this month:
- Generate personalized message
- Add to email campaign
- Track送信 status

# Calendar sync
For all events in Events table:
- Create/update calendar entry
- Add attendees from linked contacts
- Set reminders based on type
```

Remember: These examples show what's possible. Always test thoroughly and consider rate limits when implementing automation!