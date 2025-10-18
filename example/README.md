# Nest Sentinel Example Application

This example application demonstrates all features of the `@rastaweb/nest-sentinel` library including IP validation, API key authentication, custom strategies, and database-backed validation.

## Running the Example

```bash
# Install dependencies
npm install

# Start the development server
npm run start:dev
```

The application will be available at `http://localhost:3000`

## API Documentation

Visit `http://localhost:3000/public/docs` for complete API documentation.

## Testing Endpoints

### Public Endpoints (No Validation)

```bash
# Get public information
curl http://localhost:3000/public/info

# Health check
curl http://localhost:3000/public/health

# API documentation
curl http://localhost:3000/public/docs
```

### Protected Endpoints

```bash
# Basic IP validation (localhost should work)
curl http://localhost:3000/protected/basic

# API key validation
curl -H "x-api-key: demo-key-123" http://localhost:3000/protected/api-key

# Combined IP + API key validation
curl -H "x-api-key: demo-key-123" http://localhost:3000/protected/combined

# Private network only
curl http://localhost:3000/protected/private-network

# Custom validation rules
curl -H "authorization: Bearer demo-key-123" http://localhost:3000/protected/custom-rules

# POST with validation
curl -X POST -H "Content-Type: application/json" -H "x-api-key: demo-key-123" \
  -d '{"message": "test data"}' \
  http://localhost:3000/protected/data
```

### Admin Endpoints

```bash
# Admin user management (requires admin token)
curl -H "x-admin-token: admin-key-456" http://localhost:3000/admin/users

# System information
curl -H "x-admin-token: admin-key-456" http://localhost:3000/admin/system

# Configuration access
curl -H "x-admin-token: admin-key-456" http://localhost:3000/admin/config

# Create user
curl -X POST -H "Content-Type: application/json" -H "x-admin-token: admin-key-456" \
  -d '{"name": "New User", "email": "user@example.com", "role": "user"}' \
  http://localhost:3000/admin/users

# Emergency access (localhost only, no API key needed)
curl http://localhost:3000/admin/emergency
```

### Custom Strategy Endpoints

```bash
# Premium access (requires premium API key)
curl -H "x-api-key: premium-key-789" http://localhost:3000/custom/premium

# Business hours validation (only works during business hours)
curl http://localhost:3000/custom/business-hours

# Geographic restrictions
curl http://localhost:3000/custom/geo-restricted

# Default custom strategy
curl -H "x-api-key: demo-key-123" http://localhost:3000/custom/default
```

### Database-Backed Validation

```bash
# Get users with database validation
curl -H "x-api-key: demo-key-123" http://localhost:3000/database/users

# API key statistics (admin only)
curl -H "x-api-key: admin-key-456" http://localhost:3000/database/api-keys

# User profile
curl -H "x-api-key: demo-key-123" http://localhost:3000/database/profile

# Premium data access
curl -H "x-api-key: premium-key-789" http://localhost:3000/database/premium-data

# Create user (admin + IP restricted)
curl -X POST -H "Content-Type: application/json" -H "x-api-key: admin-key-456" \
  -d '{"name": "Test User", "role": "user"}' \
  http://localhost:3000/database/users
```

## Pre-configured API Keys

The example comes with pre-configured API keys for testing:

| API Key           | Type     | Permissions        | Description         |
| ----------------- | -------- | ------------------ | ------------------- |
| `demo-key-123`    | Standard | read               | Basic demo key      |
| `admin-key-456`   | Admin    | read, write, admin | Full admin access   |
| `premium-key-789` | Premium  | read, write        | Premium tier access |

## IP Addresses

For testing IP validation, the following ranges are typically allowed:

- `127.0.0.1` (localhost)
- `192.168.0.0/16` (private network)
- `10.0.0.0/8` (private network)

## Custom Strategies

The example includes several custom strategies:

### Premium Strategy

- Requires premium API key
- Validates network access
- Enhanced permissions

### Business Hours Strategy

- Only allows access during business hours
- Monday-Friday, 9 AM - 5 PM server time
- Geographic considerations

### Geo-Restricted Strategy

- Validates geographic location
- Blocks VPN/proxy usage
- Region-based access control

## Error Responses

When validation fails, you'll receive structured error responses:

```json
{
  "statusCode": 403,
  "message": "Access denied",
  "error": "Forbidden",
  "details": {
    "code": "IP_NOT_ALLOWED",
    "clientIP": "192.168.1.100",
    "reason": "IP address not in whitelist"
  }
}
```

## Architecture

The example demonstrates:

1. **Module Configuration**: Different ways to configure SentinelModule
2. **Decorator Usage**: All available decorators and their options
3. **Custom Implementations**: Custom stores and strategies
4. **Real-world Patterns**: Practical usage patterns
5. **Error Handling**: Proper error responses and logging
6. **Testing Strategies**: How to test protected endpoints

## Files Structure

```
example/
├── src/
│   ├── controllers/
│   │   ├── public.controller.ts          # Public endpoints
│   │   ├── protected.controller.ts       # Protected endpoints
│   │   ├── admin.controller.ts           # Admin endpoints
│   │   ├── custom-strategy.controller.ts # Custom strategy demos
│   │   └── database.controller.ts        # Database-backed validation
│   ├── services/
│   │   ├── custom-store.service.ts       # Custom store implementation
│   │   ├── custom-strategy.service.ts    # Custom strategy implementation
│   │   └── database.service.ts           # Database service mock
│   ├── app.module.ts                     # Main module configuration
│   └── main.ts                           # Application bootstrap
├── package.json
├── tsconfig.json
└── README.md
```

## Development

To modify the example:

1. **Add New Endpoints**: Create new controllers or add methods to existing ones
2. **Custom Validation**: Implement new strategies in the services directory
3. **Database Integration**: Replace the mock database service with real implementation
4. **Environment Config**: Add environment-specific configurations

## Common Use Cases

### Corporate Network Access

```typescript
@IPOnly(['10.0.0.0/8', '192.168.0.0/16'])
@Get('corporate')
getCorporateData() {
  return { data: 'Corporate only' };
}
```

### API Rate Limiting

```typescript
@Sentinel({
  apiKey: {
    type: 'apiKey',
    required: true,
    validateKey: true // This checks rate limits in metadata
  }
})
@Get('rate-limited')
getRateLimitedData() {
  return { data: 'Rate limited' };
}
```

### Multi-Factor Authentication

```typescript
@RequireBoth({
  allowedIPs: ['trusted-network-range'],
  apiKeyHeader: 'x-api-key'
})
@Get('secure')
getSecureData() {
  return { data: 'Multi-factor protected' };
}
```

## Troubleshooting

### Common Issues

1. **IP Validation Fails**: Check if your IP is in the allowed ranges
2. **API Key Invalid**: Ensure you're using the correct header name
3. **Strategy Not Found**: Verify custom strategies are properly registered
4. **Business Hours**: Check server time and timezone settings

### Debug Mode

Enable debug logging:

```bash
SENTINEL_LOG_LEVEL=debug npm run start:dev
```

This will show detailed validation logs in the console.
