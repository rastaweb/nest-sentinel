# @rastaweb/access-traffic

A production-ready NestJS library for service-to-service authentication, traffic management, and access control.

## Features

- 🔐 **API Key Authentication** - Secure service-to-service communication
- 🛡️ **Access Control** - IP/MAC/CIDR-based rules with composite logic
- 📊 **Traffic Monitoring** - Request logging and analytics
- 🚦 **Rate Limiting Ready** - Built-in traffic management foundation
- 🗄️ **Database Agnostic** - SQLite, MySQL, PostgreSQL support
- 🎯 **TypeScript First** - Fully typed with excellent IDE support
- 🔧 **CLI Tools** - Easy management of API keys and database
- 📱 **Client SDK** - Ready-to-use client with retries and error handling

## Installation

```bash
npm install @rastaweb/access-traffic
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm reflect-metadata
```

## Quick Start

### 1. Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AccessTrafficModule } from '@rastaweb/access-traffic';

@Module({
  imports: [
    AccessTrafficModule.register({
      dbUrl: process.env.DATABASE_URL || 'sqlite://./access-traffic.db',
      autoMigrate: true,
      enableLogs: true,
      globalPolicy: {
        ipWhitelist: ['10.0.0.0/8', '192.168.0.0/16'],
        requireApiKey: false,
      },
      apiKeyHeader: 'x-api-key',
      clientMacHeader: 'x-client-mac',
      trustProxy: true,
      trafficRetentionDays: 90,
    }),
  ],
})
export class AppModule {}
```

### 2. Using Guards and Decorators

```typescript
import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  AccessGuard,
  TrackTrafficInterceptor,
  AccessRule,
  RequireApiKey,
  AllowIps,
} from '@rastaweb/access-traffic';

@Controller('api')
@UseGuards(AccessGuard)
@UseInterceptors(TrackTrafficInterceptor)
export class ApiController {
  @Get('public')
  @AllowIps(['192.168.1.0/24', '10.0.0.0/8'])
  getPublicData() {
    return { message: 'Public data accessible from allowed IPs' };
  }

  @Get('private')
  @RequireApiKey(['read', 'admin'])
  getPrivateData() {
    return { message: 'Private data - API key required' };
  }

  @Get('restricted')
  @AccessRule({
    require: {
      apiKey: true,
      scopes: ['admin'],
      combined: ['ip', 'mac', 'apiKey'], // All must be present
    },
    allow: [
      { allOf: ['192.168.1.0/24', 'MAC:00-14-22-01-23-45'] }, // IP AND MAC
      { anyOf: ['10.0.0.0/8', '::1'] }, // IP OR localhost
    ],
    deny: ['192.168.1.100'], // Explicit deny
    ipVersion: 'ipv4',
    note: 'High security endpoint',
  })
  getRestrictedData() {
    return { message: 'Highly restricted data' };
  }
}
```

### 3. Service-to-Service Communication

```typescript
import { Injectable } from '@nestjs/common';
import { ApiKeyService, createClient } from '@rastaweb/access-traffic';

@Injectable()
export class MyService {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async setupServiceCommunication() {
    // Create API key for service
    const result = await this.apiKeyService.createKey(
      'service',
      'my-service-id',
      ['read', 'write'],
      'My Service API Key',
    );

    // Create client for calling other services
    const client = createClient({
      baseURL: 'https://other-service.com',
      apiKey: result.rawKey,
      retries: 3,
      timeout: 10000,
    });

    // Make authenticated requests
    const response = await client.get('/api/data');
    return response.data;
  }
}
```

## Configuration Options

```typescript
interface AccessTrafficOptions {
  // Database
  dbUrl?: string; // Default: 'sqlite://:memory:'
  autoMigrate?: boolean; // Default: false

  // Logging
  enableLogs?: boolean; // Default: true
  trafficRetentionDays?: number; // Default: 90

  // Headers
  apiKeyHeader?: string; // Default: 'x-api-key'
  clientMacHeader?: string; // Default: 'x-client-mac'

  // Network
  trustProxy?: boolean; // Default: true

  // Security
  globalPolicy?: AccessPolicy;
  serviceAuth?: {
    enabled: boolean;
    requiredScopes?: string[];
  };

  // Custom user identification
  identifyUserFromRequest?: (req: any) => Promise<{
    userId?: string;
    serviceId?: string;
  }>;
}
```

## Access Rules

### Simple Rules

```typescript
@AccessRule({
  allow: ['192.168.1.0/24', '10.0.0.1'],
  deny: ['192.168.1.100'],
  require: { apiKey: true, scopes: ['read'] },
  ipVersion: 'ipv4',
})
```

### Composite Rules

```typescript
@AccessRule({
  allow: [
    { allOf: ['192.168.1.0/24', 'MAC:00-14-22-01-23-45'] }, // Both required
    { anyOf: ['10.0.0.0/8', '127.0.0.1'] }, // Either required
  ],
  require: {
    combined: ['ip', 'mac', 'apiKey'], // All three required
  },
})
```

### MAC Address Matching

```typescript
@AccessRule({
  allow: [
    'MAC:00-14-22-01-23-45', // Specific MAC
    { anyOf: ['MAC:00-14-22-*', 'MAC:00-15-*'] }, // Wildcard support
  ],
})
```

## CLI Usage

### Initialize Database

```bash
npx access-traffic init-db --url sqlite://./mydb.db
```

### Create API Keys

```bash
# Create service API key
npx access-traffic create-key \
  --owner-type service \
  --owner-id my-service \
  --scopes read,write,admin \
  --name "My Service Key"

# Create user API key with expiration
npx access-traffic create-key \
  --owner-type user \
  --owner-id user123 \
  --scopes read \
  --expires "2024-12-31T23:59:59Z"
```

### Manage Keys

```bash
# List all keys
npx access-traffic list-keys

# List keys for specific owner
npx access-traffic list-keys --owner-type service --owner-id my-service

# Revoke a key
npx access-traffic revoke-key --id <key-id>

# View traffic statistics
npx access-traffic stats --since "2024-01-01T00:00:00Z"
```

## Client SDK

### Basic Usage

```typescript
import { createClient } from '@rastaweb/access-traffic';

const client = createClient({
  baseURL: 'https://api.example.com',
  apiKey: 'your-api-key',
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
});

// GET request
const users = await client.get('/users');

// POST with data
const newUser = await client.post('/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// With custom headers
const data = await client.get('/data', {
  headers: { 'x-custom': 'value' },
});
```

### Advanced Configuration

```typescript
const client = createClient({
  baseURL: 'https://api.example.com',
  apiKey: 'your-api-key',
  retries: 5,
  retryDelay: 2000,
  headers: {
    'User-Agent': 'MyApp/1.0',
    'x-client-mac': '00-14-22-01-23-45',
  },
});

// Update API key
client.updateApiKey('new-api-key');

// Add default header
client.setDefaultHeader('x-version', '2.0');
```

## Database Entities

### ApiKey Entity

```typescript
{
  id: string;           // UUID
  name: string;         // Human-readable name
  key: string;          // Hashed API key
  ownerType: 'user' | 'service';
  ownerId: string;      // User/Service identifier
  scopes: string[];     // Permissions array
  isActive: boolean;    // Active status
  createdAt: Date;      // Creation timestamp
  expiresAt?: Date;     // Optional expiration
  lastUsedAt?: Date;    // Last usage timestamp
}
```

### TrafficLog Entity

```typescript
{
  id: string;             // UUID
  timestamp: Date;        // Request timestamp
  method: string;         // HTTP method
  path: string;           // Request path
  statusCode: number;     // HTTP status
  durationMs: number;     // Response time
  ip: string;             // Client IP
  ipVersion: 'ipv4' | 'ipv6';
  clientMac?: string;     // Client MAC (if provided)
  apiKeyId?: string;      // Associated API key
  serviceId?: string;     // Service identifier
  userId?: string;        // User identifier
  requestHeaders: object; // Sanitized headers
  responseSize?: number;  // Response size in bytes
  routeName?: string;     // Controller.method
}
```

### AccessEvent Entity

```typescript
{
  id: string;                    // UUID
  timestamp: Date;               // Event timestamp
  decision: 'allow' | 'deny';   // Access decision
  reason: string;               // Decision reason
  ruleMeta?: object;            // Rule metadata
  ip: string;                   // Client IP
  clientMac?: string;           // Client MAC
  apiKeyId?: string;            // Associated API key
}
```

## Monitoring and Analytics

### Traffic Service

```typescript
import { TrafficService } from '@rastaweb/access-traffic';

@Injectable()
export class AnalyticsService {
  constructor(private readonly trafficService: TrafficService) {}

  async getTrafficStats() {
    // Get recent traffic stats
    const stats = await this.trafficService.getTrafficStats(
      new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    );

    // Query specific logs
    const logs = await this.trafficService.queryLogs({
      ip: '192.168.1.100',
      since: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      limit: 50,
    });

    return { stats, logs };
  }
}
```

## Environment Variables

```env
# Database
DATABASE_URL=mysql://user:pass@localhost:3306/mydb
# or
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
# or
DATABASE_URL=sqlite://./access-traffic.db

# API Configuration
API_KEY_HEADER=x-api-key
CLIENT_MAC_HEADER=x-client-mac
TRUST_PROXY=true
ENABLE_LOGS=true
TRAFFIC_RETENTION_DAYS=90
AUTO_MIGRATE=false
```

## Migration from Existing Projects

If you're migrating from an existing authentication system:

1. **Install the library** and configure the module
2. **Migrate API keys** using the CLI or service methods
3. **Add decorators** to existing controllers gradually
4. **Enable traffic monitoring** for insights
5. **Implement client SDK** for service-to-service calls

## Security Best Practices

1. **Use HTTPS** in production
2. **Rotate API keys** regularly
3. **Monitor access events** for suspicious activity
4. **Use specific scopes** rather than broad permissions
5. **Implement rate limiting** at the application level
6. **Sanitize logs** to avoid sensitive data exposure
7. **Use IP whitelisting** for critical endpoints

## Performance Considerations

- **Async logging**: Traffic logs are queued and processed asynchronously
- **Database indexes**: Entities include proper indexes for common queries
- **Connection pooling**: Uses TypeORM's built-in connection pooling
- **Memory management**: Automatic cleanup of old logs based on retention policy
- **Efficient querying**: Optimized queries for access control checks

## Troubleshooting

### Common Issues

1. **Database connection errors**: Check `dbUrl` format and connectivity
2. **API key validation fails**: Verify header name configuration
3. **Access denied unexpectedly**: Check rule evaluation order (deny rules first)
4. **Performance issues**: Consider database indexing and connection pooling

### Debug Mode

Enable detailed logging:

```typescript
AccessTrafficModule.register({
  enableLogs: true,
  // Add to TypeORM config for SQL logging
  logging: ['query', 'error'],
});
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details.

## Support

- 📚 [Documentation](https://github.com/your-org/access-traffic)
- 🐛 [Issue Tracker](https://github.com/your-org/access-traffic/issues)
- 💬 [Discussions](https://github.com/your-org/access-traffic/discussions)
