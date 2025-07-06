# Access Control Guide

The MCP Airtable server includes comprehensive access control features to restrict which bases, tables, and views the AI assistant can access. This prevents the AI from accessing or modifying sensitive data.

## Overview

Access control works at three levels:
1. **Base Level** - Control which Airtable bases can be accessed
2. **Table Level** - Control which tables within bases can be accessed
3. **View Level** - Control which views can be used for queries

## Configuration Modes

### 1. Allowlist Mode (Default)
Only explicitly allowed items can be accessed. This is the most secure mode.

```bash
ACCESS_CONTROL_MODE=allowlist
ALLOWED_BASES=appProductionData,appTestData
ALLOWED_TABLES=Customers,Orders,Products
```

### 2. Blocklist Mode
All items are allowed except those explicitly blocked.

```bash
ACCESS_CONTROL_MODE=blocklist
BLOCKED_TABLES=Salaries,PersonalInfo,Passwords
BLOCKED_BASES=appSensitiveHR
```

### 3. Both Mode
Combines allowlist and blocklist. Items must be in the allowlist AND not in the blocklist.

```bash
ACCESS_CONTROL_MODE=both
ALLOWED_BASES=appCompanyData
BLOCKED_TABLES=ExecutiveCompensation,SSNs
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ACCESS_CONTROL_MODE` | Control mode: `allowlist`, `blocklist`, or `both` | `allowlist` |
| `ALLOWED_BASES` | Comma-separated list of allowed base IDs | `appXXX,appYYY` |
| `ALLOWED_TABLES` | Comma-separated list of allowed table names/IDs | `Customers,Orders` |
| `ALLOWED_VIEWS` | Comma-separated list of allowed view names/IDs | `Active Items,Public View` |
| `BLOCKED_BASES` | Comma-separated list of blocked base IDs | `appSensitive` |
| `BLOCKED_TABLES` | Comma-separated list of blocked table names | `Passwords,SSNs` |
| `BLOCKED_VIEWS` | Comma-separated list of blocked view names | `Internal Only` |

## Examples

### Example 1: Production Setup with Allowlist

Only allow access to specific production tables:

```bash
# .env
ACCESS_CONTROL_MODE=allowlist
ALLOWED_BASES=appProductionBase
ALLOWED_TABLES=Products,PublicOrders,Inventory
ALLOWED_VIEWS=Customer Facing,API View
```

### Example 2: Development with Blocklist

Allow all access except sensitive tables:

```bash
# .env
ACCESS_CONTROL_MODE=blocklist
BLOCKED_TABLES=Users,AuthTokens,PaymentMethods,PersonalData
```

### Example 3: Multi-Base Setup

Allow specific bases and tables:

```bash
# .env
ACCESS_CONTROL_MODE=allowlist
ALLOWED_BASES=appSales2024,appMarketing2024
ALLOWED_TABLES=Leads,Campaigns,PublicMetrics
# Don't set ALLOWED_VIEWS to allow all views in allowed tables
```

### Example 4: Maximum Security

Use both modes for strictest control:

```bash
# .env
ACCESS_CONTROL_MODE=both
ALLOWED_BASES=appPublicData
ALLOWED_TABLES=Products,Categories,PublicReviews
BLOCKED_TABLES=InternalNotes,StaffComments
BLOCKED_VIEWS=Draft View,Internal Metrics
```

## How It Works

1. **Base Operations** (`list_bases`):
   - Returns only allowed bases
   - Filters out blocked bases

2. **Table Operations** (`list_tables`, `get_records`, etc.):
   - Checks base access first (if base ID provided)
   - Checks table access
   - Returns error if access denied

3. **View Operations** (`get_records` with view parameter):
   - Checks base and table access
   - Checks view access
   - Returns error if any check fails

## Error Messages

When access is denied, the AI will receive clear error messages:

- `Access denied: Base 'appXXX' is not allowed`
- `Access denied: Table 'SensitiveData' is not allowed`
- `Access denied: View 'Internal Only' is not allowed`

## Best Practices

1. **Use Allowlist Mode in Production**
   - Explicitly define what the AI can access
   - More secure than blocklist mode

2. **Be Specific with Table Names**
   - Use exact table names as they appear in Airtable
   - Table IDs can also be used for more precision

3. **Test Access Control**
   - Verify the AI cannot access restricted data
   - Check logs for access denial messages

4. **Regular Reviews**
   - Periodically review allowed/blocked lists
   - Update as your Airtable structure changes

5. **Combine with API Key Scopes**
   - Use Airtable API keys with limited scopes
   - Access control provides additional layer of security

## Logging

Access control events are logged for audit purposes:

```
INFO: Access control configured (allowlist): 2 allowed bases, 5 allowed tables
WARN: Base access denied (not in allowlist): baseId=appSensitive
WARN: Table access denied (blocklisted): tableName=Passwords
```

## Troubleshooting

### AI Cannot Access Expected Data

1. Check if the base/table/view is in the allowlist
2. Ensure it's not in the blocklist
3. Verify exact names match (case-sensitive)
4. Check logs for specific denial reasons

### Access Control Not Working

1. Verify environment variables are set correctly
2. Restart the MCP server after changes
3. Check that `ACCESS_CONTROL_MODE` is set
4. Look for configuration log on startup

### Performance Considerations

- Access control checks are very fast (in-memory)
- No additional API calls are made
- Filtering happens before Airtable API requests