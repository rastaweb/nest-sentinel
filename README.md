# @rastaweb/sentinel

> 🔐 Production-ready NestJS library for service-to-service authentication, traffic management, and access control

![Logo](https://avatars.githubusercontent.com/u/238212114?s=48&v=4)
[![npm version](https://badge.fury.io/js/%40rastaweb%2Fsentinel.svg)](https://badge.fury.io/js/%40rastaweb%2Fsentinel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## 🚀 Quick Start

### Installation

```bash
npm install @rastaweb/sentinel
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm reflect-metadata
```

### Basic Setup

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { SentinelModule } from "@rastaweb/sentinel";

@Module({
  imports: [
    SentinelModule.register({
      dbUrl: process.env.DATABASE_URL || "sqlite://./sentinel.db",
      autoMigrate: true,
      enableLogs: true,
      globalPolicy: {
        ipWhitelist: ["10.0.0.0/8", "192.168.0.0/16"],
        requireApiKey: false,
      },
    }),
  ],
})
export class AppModule {}
```

## 🔧 Core Features

### ✅ What You Get

- 🔐 **API Key Authentication** - Secure service-to-service communication
- 🛡️ **IP/MAC Access Control** - CIDR-based network security
- 📊 **Traffic Monitoring** - Request logging and analytics
- �️ **Multi-Database Support** - SQLite, MySQL, PostgreSQL
- 🔧 **CLI Management** - Easy API key and database management
- 📱 **HTTP Client SDK** - Ready-to-use client with retries

### 🎯 Perfect For

- Microservice authentication
- Partner API access control
- Internal tool security
- IoT device management
- Audit logging requirements

## 📖 Usage Examples

### 1. Protect Routes with API Keys

```typescript
import { Controller, Get } from "@nestjs/common";
import { RequireApiKey } from "@rastaweb/sentinel";

@Controller("api")
export class ApiController {
  @Get("public")
  public() {
    return { message: "This is public" };
  }

  @RequireApiKey()
  @Get("protected")
  protected() {
    return { message: "This requires API key" };
  }

  @RequireApiKey(["admin", "write"])
  @Get("admin")
  admin() {
    return { message: "This requires admin scope" };
  }
}
```

### 2. IP-Based Access Control

```typescript
import { Controller, Get } from "@nestjs/common";
import { AccessRule, AllowIps, DenyIps } from "@rastaweb/sentinel";

@Controller("secure")
export class SecureController {
  @AllowIps(["192.168.1.0/24", "10.0.0.0/8"])
  @Get("internal")
  internal() {
    return { message: "Only internal network access" };
  }

  @DenyIps(["192.168.1.100"])
  @Get("blocked")
  blocked() {
    return { message: "Specific IP blocked" };
  }

  @AccessRule({
    allow: ["192.168.1.0/24"],
    require: { apiKey: true, scopes: ["admin"] },
  })
  @Get("admin-internal")
  adminInternal() {
    return { message: "Admin access from internal network" };
  }
}
```

### 3. Advanced Access Rules

```typescript
import { AccessRule } from "@rastaweb/sentinel";

@Controller("advanced")
export class AdvancedController {
  @AccessRule({
    allow: [
      "192.168.1.0/24",
      { anyOf: ["10.0.0.0/8", "MAC:00-14-22-01-23-45"] },
    ],
    deny: ["192.168.1.100"],
    require: {
      combined: ["ip", "apiKey"], // Both IP and API key required
      scopes: ["read", "write"],
    },
    ipVersion: "ipv4", // Only IPv4 allowed
  })
  @Get("complex")
  complex() {
    return { message: "Complex access rules applied" };
  }
}
```

### 4. Using the HTTP Client

```typescript
// client.service.ts
import { Injectable } from "@nestjs/common";
import { SentinelClient } from "@rastaweb/sentinel";

@Injectable()
export class ApiClientService {
  private client: SentinelClient;

  constructor() {
    this.client = new SentinelClient({
      baseURL: "https://api.example.com",
      apiKey: process.env.API_KEY,
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
    });
  }

  async getData() {
    return this.client.get("/data");
  }

  async postData(data: any) {
    return this.client.post("/data", data);
  }
}
```

## ⚙️ Configuration Options

### Module Configuration

```typescript
interface SentinelOptions {
  dbUrl?: string; // Database connection URL
  autoMigrate?: boolean; // Auto-create tables (default: false)
  enableLogs?: boolean; // Enable request logging (default: true)
  apiKeyHeader?: string; // API key header name (default: 'x-api-key')
  clientMacHeader?: string; // MAC address header (default: 'x-client-mac')
  trustProxy?: boolean; // Trust proxy headers (default: true)
  trafficRetentionDays?: number; // Log retention period (default: 90)

  globalPolicy?: {
    ipWhitelist?: string[]; // Global IP whitelist
    requireApiKey?: boolean; // Global API key requirement
    allowedMacs?: string[]; // Global MAC whitelist
    deniedIps?: string[]; // Global IP blacklist
  };

  // Custom user identification
  identifyUserFromRequest?: (req: any) => Promise<{
    userId?: string;
    serviceId?: string;
  }>;
}
```

### Database URLs

```typescript
// SQLite (development)
{
  dbUrl: "sqlite://./sentinel.db";
}

// MySQL (production)
{
  dbUrl: "mysql://user:password@localhost:3306/database";
}

// PostgreSQL (enterprise)
{
  dbUrl: "postgres://user:password@localhost:5432/database";
}
```

### Async Configuration

```typescript
SentinelModule.registerAsync({
  useFactory: async (configService: ConfigService) => ({
    dbUrl: configService.get("DATABASE_URL"),
    enableLogs: configService.get("ENABLE_TRAFFIC_LOGS", true),
    globalPolicy: {
      ipWhitelist: configService.get("ALLOWED_IPS", "").split(","),
      requireApiKey: configService.get("REQUIRE_API_KEY", false),
    },
  }),
  inject: [ConfigService],
});
```

## 🔑 API Key Management

### Using the CLI

```bash
# Install globally for CLI access
npm install -g @rastaweb/sentinel

# Initialize database
sentinel init-db --url sqlite://./security.db

# Create API key
sentinel create-key \
  --owner-type service \
  --owner-id payment-service \
  --name "Payment Service Key" \
  --scopes read,write,admin

# List keys
sentinel list-keys --owner-type service

# Revoke key
sentinel revoke-key --key-id abc123def456
```

### Programmatic Management

```typescript
// api-key-manager.service.ts
import { Injectable } from "@nestjs/common";
import { ApiKeyService } from "@rastaweb/sentinel";

@Injectable()
export class ApiKeyManagerService {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async createServiceKey(serviceId: string, scopes: string[]) {
    const result = await this.apiKeyService.createKey(
      "service",
      serviceId,
      scopes,
      `${serviceId} API Key`,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    );

    return {
      keyId: result.apiKey.id,
      key: result.rawKey, // Save this securely!
      scopes: result.apiKey.scopes,
    };
  }

  async validateKey(apiKey: string, requiredScope?: string) {
    return this.apiKeyService.validateKey(apiKey, requiredScope);
  }
}
```

## 📊 Traffic Analytics

### Query Traffic Logs

```typescript
// analytics.service.ts
import { Injectable } from "@nestjs/common";
import { TrafficService } from "@rastaweb/sentinel";

@Injectable()
export class AnalyticsService {
  constructor(private readonly trafficService: TrafficService) {}

  async getApiUsage(apiKeyId: string, days: number = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.trafficService.queryLogs({
      apiKeyId,
      since,
      limit: 1000,
    });
  }

  async getTrafficStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h
    return this.trafficService.getTrafficStats(since);
  }

  async getTopIPs(limit: number = 10) {
    // Custom query implementation
    const logs = await this.trafficService.queryLogs({
      since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      limit: 10000,
    });

    // Process and aggregate by IP
    const ipCounts = logs.reduce(
      (acc, log) => {
        acc[log.ip] = (acc[log.ip] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(ipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
  }
}
```

## 🛡️ Security Best Practices

### 1. Environment Variables

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/production
API_KEY_HEADER=x-api-key
ENABLE_TRAFFIC_LOGS=true
ALLOWED_IPS=10.0.0.0/8,192.168.0.0/16
REQUIRE_API_KEY=true
```

### 2. Production Configuration

```typescript
// production.config.ts
export const productionConfig = {
  dbUrl: process.env.DATABASE_URL,
  autoMigrate: false, // Use migrations in production
  enableLogs: true,
  trustProxy: true, // Behind load balancer
  trafficRetentionDays: 90,

  globalPolicy: {
    requireApiKey: true,
    ipWhitelist: process.env.ALLOWED_IPS?.split(",") || [],
    deniedIps: process.env.BLOCKED_IPS?.split(",") || [],
  },
};
```

### 3. API Key Security

```typescript
// Store API keys securely
const keyResult = await apiKeyService.createKey(
  "service",
  "payment-service",
  ["read", "write"],
  "Payment Service",
  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
);

// ⚠️ Save the raw key securely - it cannot be retrieved again!
console.log("API Key:", keyResult.rawKey);

// ✅ Store only the key ID in your database
await serviceRepository.save({
  name: "payment-service",
  apiKeyId: keyResult.apiKey.id,
});
```

## 🚨 Common Patterns

### 1. Microservice Authentication

```typescript
// microservice.module.ts
@Module({
  imports: [
    SentinelModule.register({
      dbUrl: process.env.DATABASE_URL,
      enableLogs: true,
      globalPolicy: {
        requireApiKey: true,
        ipWhitelist: ["10.0.0.0/8"], // Internal network only
      },
    }),
  ],
})
export class MicroserviceModule {}

// Protected controller
@Controller()
export class ServiceController {
  @RequireApiKey(["service"])
  @Get("health")
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
```

### 2. Partner API Gateway

```typescript
// partner-api.module.ts
@Module({
  imports: [
    SentinelModule.register({
      dbUrl: process.env.DATABASE_URL,
      enableLogs: true,
      trafficRetentionDays: 365, // Longer retention for partner APIs

      globalPolicy: {
        requireApiKey: true,
        // No IP restrictions for external partners
      },
    }),
  ],
})
export class PartnerApiModule {}

@Controller("partner")
export class PartnerController {
  @RequireApiKey(["partner-read"])
  @Get("data")
  getData() {
    return { data: "Partner data" };
  }

  @RequireApiKey(["partner-write"])
  @Post("webhook")
  webhook(@Body() data: any) {
    // Process partner webhook
    return { received: true };
  }
}
```

### 3. Admin Dashboard

```typescript
// admin.controller.ts
@Controller("admin")
export class AdminController {
  @AccessRule({
    allow: ["192.168.1.0/24"], // Admin network only
    require: {
      apiKey: true,
      scopes: ["admin"],
    },
  })
  @Get("dashboard")
  dashboard() {
    return { message: "Admin dashboard" };
  }

  @AccessRule({
    allow: ["192.168.1.0/24"],
    require: {
      apiKey: true,
      scopes: ["admin", "system"],
    },
  })
  @Delete("cache")
  clearCache() {
    // Clear system cache
    return { cleared: true };
  }
}
```

## 🔧 Troubleshooting

### Common Issues

**1. Database Connection Errors**

```typescript
// Check your database URL format
// SQLite: sqlite://./path/to/db.sqlite
// MySQL: mysql://user:pass@host:port/db
// PostgreSQL: postgres://user:pass@host:port/db
```

**2. API Key Not Working**

```typescript
// Ensure the header name matches your configuration
const config = {
  apiKeyHeader: "x-api-key", // Default
  // Send requests with this header
};

// Check key is active and not expired
const validation = await apiKeyService.validateKey(apiKey);
console.log("Key valid:", validation.valid);
```

**3. IP Access Denied**

```typescript
// Check if IP is in whitelist/blacklist
const clientInfo = parseClientIp(request, true);
console.log("Client IP:", clientInfo.ip);

// Verify CIDR ranges
console.log("Match:", matchIpOrRange("192.168.1.100", "192.168.1.0/24")); // true
```

**4. Tests Hanging**

```typescript
// Ensure proper cleanup in tests
afterEach(() => {
  // TrafficService has background timers
  trafficService.cleanup();
});
```

### Debug Mode

```typescript
// Enable detailed logging
SentinelModule.register({
  enableLogs: true,
  // Add custom logger
  identifyUserFromRequest: async (req) => {
    console.log("Request headers:", req.headers);
    console.log("Client IP:", parseClientIp(req).ip);
    return {};
  },
});
```

## 📚 Additional Resources

- [Full API Documentation](./DOCUMENTATION.md)
- [GitHub Repository](https://github.com/rastaweb/nest-sentinel)
- [Issue Tracker](https://github.com/rastaweb/nest-sentinel/issues)
- [NestJS Documentation](https://docs.nestjs.com/)

## 📄 License

MIT © [Rastaweb](https://github.com/rastaweb)

---

**Need help?** Open an issue on [GitHub](https://github.com/rastaweb/nest-sentinel/issues) or check the [documentation](./DOCUMENTATION.md) for advanced usage patterns.
],
})
export class AppModule {}

### 2. Using Guards and Decorators

````typescript
import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  AccessGuard,
  TrackTrafficInterceptor,
  AccessRule,
  RequireApiKey,
  AllowIps,
} from '@rastaweb/sentinel';

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

### 3. Service-to-Service Communication

```typescript
import { Injectable } from "@nestjs/common";
import { ApiKeyService, createClient } from "@rastaweb/sentinel";

@Injectable()
export class MyService {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async setupServiceCommunication() {
    // Create API key for service
    const result = await this.apiKeyService.createKey(
      "service",
      "my-service-id",
      ["read", "write"],
      "My Service API Key"
    );

    // Create client for calling other services
    const client = createClient({
      baseURL: "https://other-service.com",
      apiKey: result.rawKey,
      retries: 3,
      timeout: 10000,
    });

    // Make authenticated requests
    const response = await client.get("/api/data");
    return response.data;
  }
}

## Configuration Options

```typescript
interface SentinelOptions {
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
````

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
npx sentinel init-db --url sqlite://./mydb.db
```

### Create API Keys

```bash
# Create service API key
npx sentinel create-key \
  --owner-type service \
  --owner-id my-service \
  --scopes read,write,admin \
  --name "My Service Key"

# Create user API key with expiration
npx sentinel create-key \
  --owner-type user \
  --owner-id user123 \
  --scopes read \
  --expires "2024-12-31T23:59:59Z"
```

### Manage Keys

```bash
# List all keys
npx sentinel list-keys

# List keys for specific owner
npx sentinel list-keys --owner-type service --owner-id my-service

# Revoke a key
npx sentinel revoke-key --id <key-id>

# View traffic statistics
npx sentinel stats --since "2024-01-01T00:00:00Z"
```

## Client SDK

### Basic Usage

```typescript
import { createClient } from "@rastaweb/sentinel";

const client = createClient({
  baseURL: "https://api.example.com",
  apiKey: "your-api-key",
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
});

// GET request
const users = await client.get("/users");

// POST with data
const newUser = await client.post("/users", {
  name: "John Doe",
  email: "john@example.com",
});

// With custom headers
const data = await client.get("/data", {
  headers: { "x-custom": "value" },
});
```

### Advanced Configuration

```typescript
const client = createClient({
  baseURL: "https://api.example.com",
  apiKey: "your-api-key",
  retries: 5,
  retryDelay: 2000,
  headers: {
    "User-Agent": "MyApp/1.0",
    "x-client-mac": "00-14-22-01-23-45",
  },
});

// Update API key
client.updateApiKey("new-api-key");

// Add default header
client.setDefaultHeader("x-version", "2.0");
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
import { TrafficService } from "@rastaweb/sentinel";

@Injectable()
export class AnalyticsService {
  constructor(private readonly trafficService: TrafficService) {}

  async getTrafficStats() {
    // Get recent traffic stats
    const stats = await this.trafficService.getTrafficStats(
      new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    // Query specific logs
    const logs = await this.trafficService.queryLogs({
      ip: "192.168.1.100",
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
DATABASE_URL=sqlite://./sentinel.db

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
SentinelModule.register({
  enableLogs: true,
  // Add to TypeORM config for SQL logging
  logging: ["query", "error"],
});
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details.

## Support

- 📚 [Documentation](https://github.com/your-org/sentinel)
- 🐛 [Issue Tracker](https://github.com/your-org/sentinel/issues)
- 💬 [Discussions](https://github.com/your-org/sentinel/discussions)
