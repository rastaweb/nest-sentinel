# NestJS Sentinel 🛡️

A production-ready NestJS library for service-to-service authentication, traffic management, and access control. Sentinel provides comprehensive security features including API key management, IP/MAC-based access control, traffic logging, and granular permission scoping.

[![npm version](https://badge.fury.io/js/@rastaweb%2Fnest-sentinel.svg)](https://badge.fury.io/js/@rastaweb%2Fnest-sentinel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

### Core Security Features

- **🔐 API Key Authentication** - Secure key generation, validation, and rotation
- **🌐 IP/MAC Access Control** - CIDR-based IP filtering and MAC address validation
- **📊 Traffic Management** - Request/response logging with queued processing
- **🔍 Access Event Logging** - Security event tracking and audit trails
- **⚡ Performance Optimized** - Asynchronous processing with background queues

### Advanced Features

- **🎯 Granular Scoping** - Fine-grained permission control per API key
- **🔄 Key Rotation** - Automated and manual key rotation capabilities
- **📈 Analytics & Monitoring** - Built-in traffic statistics and reporting
- **🔧 CLI Management** - Command-line tools for administration
- **🌟 Flexible Rules** - Complex access rules with AND/OR logic
- **🚫 Skip Mechanisms** - Granular control over which routes use protection

### Infrastructure Support

- **🗄️ Multi-Database** - SQLite, MySQL, PostgreSQL support via TypeORM
- **⚙️ Easy Integration** - Simple NestJS module registration
- **🔒 Production Ready** - Built with enterprise security in mind
- **📦 HTTP Client** - Built-in client with automatic retries

## 📦 Installation

```bash
npm install @rastaweb/nest-sentinel
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm reflect-metadata
```

## 🛠️ Quick Start

### 1. Basic Setup

```typescript
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SentinelModule } from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "sqlite",
      database: "app.db",
      autoLoadEntities: true,
      synchronize: true, // Don't use in production
    }),
    SentinelModule.register({
      enableLogs: true,
      trafficRetentionDays: 30,
      globalPolicy: {
        ipWhitelist: ["192.168.1.0/24"],
        requireApiKey: true,
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Protect Your Routes

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  AccessGuard,
  AccessRule,
  RequireApiKey,
  AllowIps,
  TrackTrafficInterceptor,
} from "@rastaweb/nest-sentinel";

@Controller("api")
@UseGuards(AccessGuard)
@UseInterceptors(TrackTrafficInterceptor)
export class ApiController {
  @Get("public")
  @AccessRule({
    allow: ["192.168.1.0/24", "10.0.0.0/8"],
    ipVersion: "ipv4",
  })
  getPublicData() {
    return { message: "Public data" };
  }

  @Get("protected")
  @RequireApiKey(["read", "admin"])
  getProtectedData() {
    return { message: "Protected data" };
  }

  @Get("admin")
  @AccessRule({
    require: {
      apiKey: true,
      scopes: ["admin"],
      combined: ["ip", "apiKey"],
    },
    allow: ["192.168.1.100"],
    note: "Admin access only from secure network",
  })
  getAdminData() {
    return { message: "Admin data" };
  }
}
```

### 3. CLI Management

Initialize database tables:

```bash
npx sentinel init-db --url "sqlite://./app.db"
```

Create API keys:

```bash
npx sentinel create-key \
  --owner-type service \
  --owner-id my-service \
  --scopes "read,write,admin" \
  --name "My Service Key"
```

List existing keys:

```bash
npx sentinel list-keys --owner-type service
```

View traffic statistics:

```bash
npx sentinel stats --since "2024-01-01"
```

## 📖 Complete Configuration Guide

### SentinelOptions Interface

```typescript
interface SentinelOptions {
  // Database Configuration
  dbUrl?: string; // Database connection URL
  autoMigrate?: boolean; // Auto-run migrations (default: false)

  // Logging Configuration
  enableLogs?: boolean; // Enable traffic logging (default: true)
  trafficRetentionDays?: number; // Log retention period (default: 90)

  // Global Access Policy
  globalPolicy?: {
    ipWhitelist?: string[]; // Global IP whitelist (CIDR supported)
    requireApiKey?: boolean; // Require API key globally
    allowedMacs?: string[]; // Allowed MAC addresses
    deniedIps?: string[]; // Denied IP addresses
  };

  // Header Configuration
  apiKeyHeader?: string; // API key header name (default: 'x-api-key')
  clientMacHeader?: string; // MAC address header (default: 'x-client-mac')
  trustProxy?: boolean; // Trust proxy headers (default: true)

  // Skip Options
  skipGlobalGuards?: boolean; // Skip all guards globally
  skipTrafficLogging?: boolean; // Skip traffic logging globally
  skipAccessLogging?: boolean; // Skip access logging globally

  // Service Authentication
  serviceAuth?: {
    enabled: boolean;
    requiredScopes?: string[];
  };

  // Custom User Identification
  identifyUserFromRequest?: (req: any) => Promise<{
    userId?: string;
    serviceId?: string;
  }>;
}
```

### Access Rule Options

```typescript
interface AccessRuleOptions {
  // IP/MAC Access Control
  allow?: Array<
    | string
    | {
        // Allow rules
        anyOf?: string[]; // Any of these patterns
        allOf?: string[]; // All of these patterns
      }
  >;
  deny?: Array<
    | string
    | {
        // Deny rules (takes precedence)
        anyOf?: string[];
        allOf?: string[];
      }
  >;

  // Requirements
  require?: {
    apiKey?: boolean; // Require valid API key
    scopes?: string[]; // Required scopes
    combined?: Array<"ip" | "mac" | "apiKey" | "ipVersion">;
  };

  // IP Version Control
  ipVersion?: "ipv4" | "ipv6" | "any";

  // Skip Options (route-specific)
  skipGuard?: boolean; // Skip access guard
  skipTrafficLogging?: boolean; // Skip traffic logging
  skipAccessLogging?: boolean; // Skip access logging

  // Documentation
  note?: string; // Rule description
}
```

## 🎯 Advanced Usage Examples

### Complex Access Rules

```typescript
@AccessRule({
  // Allow specific networks OR admin IPs
  allow: [
    { anyOf: ['192.168.1.0/24', '10.0.0.0/8'] },
    '203.0.113.100'  // Admin IP
  ],
  // Deny specific problematic IPs
  deny: ['192.168.1.50', '10.0.0.100'],
  // Require API key with admin scope AND valid IP
  require: {
    apiKey: true,
    scopes: ['admin'],
    combined: ['ip', 'apiKey']
  },
  ipVersion: 'ipv4',
  note: 'Admin endpoint with network restrictions'
})
@Get('admin/users')
async getUsers() {
  return this.userService.findAll();
}
```

### MAC Address Filtering

```typescript
@AccessRule({
  allow: [
    'MAC:00-14-22-01-23-45',        // Specific device
    '192.168.1.0/24'                // Local network
  ],
  require: {
    combined: ['mac', 'ip']         // Require both MAC and IP
  }
})
@Get('secure-data')
async getSecureData() {
  return this.dataService.getSecure();
}
```

### Conditional Skip Logic

```typescript
@Controller("api")
export class ApiController {
  @Get("health")
  @SkipAllSentinel() // Skip all Sentinel features
  healthCheck() {
    return { status: "ok" };
  }

  @Get("metrics")
  @SkipSentinel() // Skip access guard only
  @TrackTrafficInterceptor // But still log traffic
  getMetrics() {
    return this.metricsService.get();
  }

  @Get("internal")
  @AccessRule({
    skipTrafficLogging: true, // Skip logging for internal calls
    require: { apiKey: true },
  })
  internalApi() {
    return { data: "internal" };
  }
}
```

### Service-to-Service Authentication

```typescript
// Service A calling Service B
const client = new SentinelClient({
  baseURL: "https://service-b.example.com",
  apiKey: "ak_your_generated_key_here",
  retries: 3,
  timeout: 5000,
});

const userData = await client.get("/api/users/123");
```

### Custom User Identification

```typescript
SentinelModule.register({
  identifyUserFromRequest: async (req) => {
    // Extract from JWT token
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const payload = jwt.verify(token, secret);
      return {
        userId: payload.sub,
        serviceId: payload.service_id,
      };
    }
    return {};
  },
});
```

## 🔧 API Reference

### ApiKeyService

```typescript
class ApiKeyService {
  // Create new API key
  async createKey(
    ownerType: "user" | "service",
    ownerId: string,
    scopes: string[] = [],
    name?: string,
    expiresAt?: Date
  ): Promise<{ apiKey: ApiKeyRecord; rawKey: string }>;

  // Validate API key
  async validateKey(
    key: string,
    requiredScope?: string
  ): Promise<ValidationResult>;

  // Rotate API key
  async rotateKey(
    id: string
  ): Promise<{ apiKey: ApiKeyRecord; rawKey: string } | null>;

  // Revoke API key
  async invalidateKey(id: string): Promise<boolean>;

  // List keys by owner
  async listByOwner(
    ownerType: "user" | "service",
    ownerId: string
  ): Promise<ApiKeyRecord[]>;
}
```

### TrafficService

```typescript
class TrafficService {
  // Query traffic logs
  async queryLogs(options: {
    ip?: string;
    apiKeyId?: string;
    since?: Date;
    limit?: number;
    route?: string;
  }): Promise<TrafficLog[]>;

  // Get traffic statistics
  async getTrafficStats(since?: Date): Promise<{
    totalRequests: number;
    uniqueIps: number;
    averageResponseTime: number;
    statusCodeDistribution: Record<number, number>;
  }>;

  // Manual log entry
  async logRequest(logData: TrafficLogData): Promise<void>;

  // Manual access event
  async logAccessEvent(
    decision: "allow" | "deny",
    reason: string,
    ip: string,
    clientMac?: string,
    apiKeyId?: string,
    ruleMeta?: Record<string, any>
  ): Promise<void>;
}
```

### SentinelClient

```typescript
class SentinelClient {
  constructor(options: {
    baseURL: string;
    apiKey?: string;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    headers?: Record<string, string>;
  });

  async get<T>(
    url: string,
    options?: { headers?: Record<string, string> }
  ): Promise<T>;
  async post<T>(
    url: string,
    data?: any,
    options?: { headers?: Record<string, string> }
  ): Promise<T>;
  async put<T>(
    url: string,
    data?: any,
    options?: { headers?: Record<string, string> }
  ): Promise<T>;
  async patch<T>(
    url: string,
    data?: any,
    options?: { headers?: Record<string, string> }
  ): Promise<T>;
  async delete<T>(
    url: string,
    options?: { headers?: Record<string, string> }
  ): Promise<T>;

  updateApiKey(apiKey: string): void;
  setDefaultHeader(name: string, value: string): void;
  removeDefaultHeader(name: string): void;
}
```

## 🛠️ Available Decorators

### Access Control Decorators

```typescript
// Basic access rule
@AccessRule({
  allow: ['192.168.1.0/24'],
  require: { apiKey: true, scopes: ['read'] }
})

// Require API key with specific scopes
@RequireApiKey(['admin', 'write'])

// IP-based access control
@AllowIps(['192.168.1.0/24', '10.0.0.1'])
@DenyIps(['192.168.1.100'])

// IP version restrictions
@IPv4Only()
@IPv6Only()
```

### Skip Decorators

```typescript
// Skip all Sentinel functionality
@SkipAllSentinel()

// Skip only access guard
@SkipSentinel()

// Skip only traffic logging
@SkipTrafficLogging()

// Skip only access event logging
@SkipAccessLogging()
```

## 📊 Database Schema

The library automatically creates three main tables:

### api_keys

- `id` (UUID, Primary Key)
- `name` (String, API key name)
- `key` (String, Hashed key)
- `ownerType` ('user' | 'service')
- `ownerId` (String, Owner identifier)
- `scopes` (JSON, Array of scopes)
- `isActive` (Boolean)
- `createdAt` (DateTime)
- `expiresAt` (DateTime, Optional)
- `lastUsedAt` (DateTime, Optional)
- `updatedAt` (DateTime)

### traffic_logs

- `id` (UUID, Primary Key)
- `timestamp` (DateTime)
- `method` (String, HTTP method)
- `path` (String, Request path)
- `statusCode` (Integer)
- `durationMs` (Integer, Response time)
- `ip` (String, Client IP)
- `ipVersion` ('ipv4' | 'ipv6')
- `clientMac` (String, Optional)
- `apiKeyId` (UUID, Optional, Foreign Key)
- `serviceId` (String, Optional)
- `userId` (String, Optional)
- `requestHeaders` (JSON)
- `responseSize` (Integer, Optional)
- `routeName` (String, Optional)

### access_events

- `id` (UUID, Primary Key)
- `timestamp` (DateTime)
- `decision` ('allow' | 'deny')
- `reason` (String, Decision reason)
- `ruleMeta` (JSON, Optional, Rule metadata)
- `ip` (String, Client IP)
- `clientMac` (String, Optional)
- `apiKeyId` (UUID, Optional, Foreign Key)

## 🚀 Performance Optimization

### Queue-Based Logging

Traffic and access events are processed asynchronously using internal queues:

- Traffic logs: Batched in groups of 50, processed every 5 seconds
- Access events: Batched in groups of 25, processed every 5 seconds
- Automatic cleanup based on retention policy

### Database Indexing

Optimized indexes on frequently queried columns:

- `ip`, `timestamp`, `apiKeyId`, `statusCode` on traffic_logs
- `decision`, `timestamp`, `ip` on access_events
- `isActive`, `ownerType`, `ownerId` on api_keys

### Memory Management

- Background timers use `unref()` to prevent blocking process exit
- Configurable retention policies for automatic cleanup
- Efficient batching to prevent memory buildup

## 🔍 Monitoring & Analytics

### Built-in Statistics

```typescript
// Inject the TrafficService
constructor(private trafficService: TrafficService) {}

// Get comprehensive traffic stats
const stats = await this.trafficService.getTrafficStats();
console.log({
  totalRequests: stats.totalRequests,
  uniqueIps: stats.uniqueIps,
  averageResponseTime: stats.averageResponseTime,
  statusCodes: stats.statusCodeDistribution
});

// Query specific logs
const recentLogs = await this.trafficService.queryLogs({
  since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  limit: 100
});
```

### CLI Analytics

```bash
# Overall statistics
npx sentinel stats

# Statistics since specific date
npx sentinel stats --since "2024-01-01T00:00:00Z"

# With custom database
npx sentinel stats --url "mysql://user:pass@localhost/sentinel"
```

## 🔐 Security Best Practices

### API Key Management

1. **Rotation Policy**: Implement regular key rotation
2. **Scope Limitation**: Use minimal required scopes
3. **Expiration**: Set appropriate expiration dates
4. **Monitoring**: Track usage patterns and anomalies

```typescript
// Example rotation policy
@Cron('0 0 1 * *') // Monthly rotation
async rotateServiceKeys() {
  const serviceKeys = await this.apiKeyService.listByOwner('service', 'my-service');

  for (const key of serviceKeys) {
    if (this.shouldRotate(key)) {
      await this.apiKeyService.rotateKey(key.id);
      await this.notifyServiceOwner(key);
    }
  }
}
```

### Network Security

1. **IP Whitelisting**: Use CIDR notation for network ranges
2. **MAC Filtering**: For device-specific access control
3. **Proxy Trust**: Configure `trustProxy` based on infrastructure
4. **Version Control**: Restrict to IPv4/IPv6 as needed

### Monitoring Security

1. **Access Logging**: Monitor failed access attempts
2. **Rate Limiting**: Combine with rate limiting solutions
3. **Anomaly Detection**: Analyze traffic patterns
4. **Audit Trails**: Maintain comprehensive logs

## ⚠️ Common Issues & Solutions

### Issue: TypeORM Connection Errors

```typescript
// Solution: Ensure TypeORM is configured before Sentinel
@Module({
  imports: [
    TypeOrmModule.forRoot({
      // Your database config
    }),
    SentinelModule.register({
      // Sentinel config
    }),
  ],
})
```

### Issue: API Keys Not Validating

```typescript
// Solution: Check header configuration
SentinelModule.register({
  apiKeyHeader: "x-api-key", // Must match client header
  // Ensure client sends: { 'x-api-key': 'your-key' }
});
```

### Issue: IP Detection Behind Proxy

```typescript
// Solution: Configure proxy trust
SentinelModule.register({
  trustProxy: true, // Enable for load balancers/proxies
});
```

### Issue: Performance with High Traffic

```typescript
// Solution: Adjust logging settings
SentinelModule.register({
  skipTrafficLogging: true, // Skip for high-volume endpoints
  trafficRetentionDays: 7, // Reduce retention period
});
```

## 🔄 Migration & Upgrades

### Database Migrations

For production deployments, disable auto-migration and run manual migrations:

```typescript
// Development
SentinelModule.register({
  autoMigrate: true,
});

// Production
SentinelModule.register({
  autoMigrate: false,
});
```

### Version Compatibility

- NestJS 10.x and 11.x supported
- TypeORM 0.3.17+ required
- Node.js 16+ required

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/rastaweb/nest-sentinel.git
cd nest-sentinel

# Install dependencies
npm install

# Run tests
npm test

# Run with coverage
npm run test:cov

# Lint code
npm run lint

# Build
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- NestJS team for the excellent framework
- TypeORM team for database abstraction
- Contributors and early adopters

## 📞 Support

- 📧 Email: support@rastaweb.com
- 🐛 Issues: [GitHub Issues](https://github.com/rastaweb/nest-sentinel/issues)
- 📖 Documentation: [GitHub Wiki](https://github.com/rastaweb/nest-sentinel/wiki)
- 💬 Discussions: [GitHub Discussions](https://github.com/rastaweb/nest-sentinel/discussions)

---

Built with ❤️ by [Rastaweb](https://github.com/rastaweb)
