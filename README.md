# NestJS Sentinel 🛡️

A lightweight, database-free NestJS library for service-to-service authentication and access control. Sentinel provides comprehensive security features including in-memory API key management, IP/MAC-based access control, and flexible traffic logging.

[![npm version](https://badge.fury.io/js/@rastaweb%2Fnest-sentinel.svg)](https://badge.fury.io/js/@rastaweb%2Fnest-sentinel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

### Core Security Features

- **🔐 In-Memory API Key Authentication** - Lightweight key generation, validation, and management
- **🌐 IP/MAC Access Control** - CIDR-based IP filtering and MAC address validation
- **📊 Flexible Traffic Logging** - Customizable request/response logging with hooks
- **🔍 Access Event Tracking** - Security event monitoring with custom handlers
- **⚡ Zero Dependencies** - No database required, works out of the box

### Advanced Features

- **🎯 Granular Scoping** - Fine-grained permission control per API key
- **🔄 Key Management** - Programmatic key creation, rotation, and invalidation
- **📈 Real-time Analytics** - Built-in traffic statistics and monitoring
- **🌟 Flexible Rules** - Complex access rules with AND/OR logic
- **🚫 Skip Mechanisms** - Granular control over which routes use protection
- **🔌 Custom Integrations** - Hook into your own storage and logging systems

### Infrastructure Support

- **🪶 Lightweight** - No database dependencies, minimal footprint
- **⚙️ Easy Integration** - Simple NestJS module registration
- **🔒 Production Ready** - Built with enterprise security in mind
- **📦 HTTP Client** - Built-in client with automatic retries and logging control

## 📦 Installation

```bash
npm install @rastaweb/nest-sentinel
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core reflect-metadata
```

## 🛠️ Quick Start

### 1. Basic Setup

```typescript
import { Module } from "@nestjs/common";
import { SentinelModule } from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    SentinelModule.register({
      globalPolicy: {
        ipWhitelist: ["192.168.1.0/24"],
        requireApiKey: true,
      },
      // Optional: Custom API key validator
      validateApiKey: async (key, requiredScopes) => {
        // Your custom validation logic
        return {
          valid: true,
          apiKeyRecord: {
            /* ... */
          },
        };
      },
      // Optional: Custom logging handlers
      onTrafficLog: async (logData) => {
        console.log(`Traffic: ${logData.method} ${logData.path}`);
      },
      onAccessEvent: async (event) => {
        console.log(`Access ${event.decision}: ${event.reason}`);
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

### 3. API Key Management

Create and manage API keys programmatically:

```typescript
import { MemoryApiKeyService } from "@rastaweb/nest-sentinel";

@Injectable()
export class AuthService {
  constructor(private readonly apiKeyService: MemoryApiKeyService) {}

  async createServiceKey() {
    const { apiKey, rawKey } = await this.apiKeyService.createKey(
      "service",
      "my-service",
      ["read", "write", "admin"],
      "My Service Key"
    );

    console.log(`Created key: ${rawKey}`);
    return apiKey;
  }

  async validateKey(key: string) {
    const result = await this.apiKeyService.validateKey(key, ["read"]);
    return result.valid;
  }
}
```

## 📖 Complete Configuration Guide

### SentinelOptions Interface

```typescript
interface SentinelOptions {
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

  // Service Authentication
  serviceAuth?: {
    enabled: boolean;
    requiredScopes?: string[];
  };

  // Custom Integration Hooks
  identifyUserFromRequest?: (req: any) => Promise<{
    userId?: string;
    serviceId?: string;
  }>;

  // Custom API Key Validation
  validateApiKey?: (
    key: string,
    requiredScopes?: string[]
  ) => Promise<ValidationResult>;

  // Custom Event Handlers
  onAccessEvent?: (event: AccessEventData) => Promise<void> | void;
  onTrafficLog?: (logData: TrafficLogData) => Promise<void> | void;
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

### Custom API Key Integration

```typescript
// Integrate with your existing user system
SentinelModule.register({
  validateApiKey: async (key, requiredScopes) => {
    // Check against your database or external service
    const user = await userService.findByApiKey(key);
    if (!user || !user.isActive) {
      return { valid: false, error: "Invalid API key" };
    }

    // Check scopes
    if (requiredScopes?.some((scope) => !user.scopes.includes(scope))) {
      return { valid: false, error: "Insufficient permissions" };
    }

    return {
      valid: true,
      apiKeyRecord: {
        id: user.id,
        name: user.name,
        ownerType: "user",
        ownerId: user.id,
        scopes: user.scopes,
        // ... other properties
      },
    };
  },
});
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
import { SentinelClient } from "@rastaweb/nest-sentinel";

const client = new SentinelClient({
  baseURL: "https://service-b.example.com",
  apiKey: "ak_your_generated_key_here",
  retries: 3,
  timeout: 5000,
  enableLogging: true, // Enable request/response logging
});

const userData = await client.get("/api/users/123");
```

### Custom Logging Integration

```typescript
SentinelModule.register({
  // Send logs to your monitoring system
  onTrafficLog: async (logData) => {
    await monitoringService.recordTraffic({
      method: logData.method,
      path: logData.path,
      statusCode: logData.statusCode,
      responseTime: logData.durationMs,
      userAgent: logData.requestHeaders["user-agent"],
      timestamp: new Date(),
    });
  },

  // Handle security events
  onAccessEvent: async (event) => {
    if (event.decision === "deny") {
      await securityService.reportSuspiciousActivity({
        ip: event.ip,
        reason: event.reason,
        timestamp: event.timestamp || new Date(),
      });
    }
  },

  // Extract user info from JWT
  identifyUserFromRequest: async (req) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        return {
          userId: payload.sub,
          serviceId: payload.service_id,
        };
      } catch (error) {
        return {};
      }
    }
    return {};
  },
});
```

## 🔧 API Reference

### MemoryApiKeyService

```typescript
class MemoryApiKeyService {
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
    requiredScopes?: string[]
  ): Promise<ValidationResult>;

  // Revoke API key
  async invalidateKey(id: string): Promise<boolean>;

  // Get API key by ID
  async getById(id: string): Promise<ApiKeyRecord | null>;

  // List keys by owner
  async listByOwner(
    ownerType: "user" | "service",
    ownerId: string
  ): Promise<ApiKeyRecord[]>;

  // Get all keys (for management)
  getAllKeys(): ApiKeyRecord[];

  // Clear all keys (useful for testing)
  clearAll(): void;
}
```

### MemoryLoggingService

```typescript
class MemoryLoggingService {
  // Log traffic data
  async logTraffic(logData: TrafficLogData): Promise<void>;

  // Log access events
  async logAccessEvent(
    decision: "allow" | "deny",
    reason: string,
    ip: string,
    clientMac?: string,
    apiKeyId?: string,
    ruleMeta?: Record<string, any>
  ): Promise<void>;

  // Get recent traffic logs (from memory)
  getRecentTrafficLogs(limit?: number): TrafficLogData[];

  // Get recent access events (from memory)
  getRecentAccessEvents(limit?: number): AccessEventData[];

  // Get traffic statistics
  getTrafficStats(): {
    totalRequests: number;
    uniqueIps: number;
    averageResponseTime: number;
    statusCodeDistribution: Record<number, number>;
    topEndpoints: Array<{ path: string; count: number }>;
  };

  // Get access event statistics
  getAccessEventStats(): {
    totalEvents: number;
    allowedEvents: number;
    deniedEvents: number;
    topDeniedReasons: Array<{ reason: string; count: number }>;
  };

  // Clear all logs (useful for testing)
  clearLogs(): void;
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
    enableLogging?: boolean; // Control request/response logging
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

// MAC address access control
@AllowMacs(['00-14-22-01-23-45', '00-14-22-01-23-46'])
@DenyMacs(['00-14-22-01-23-47'])

// IP version restrictions
@IPv4Only()
@IPv6Only()

// Complex requirements
@RequireAll(['ip', 'apiKey', 'mac'])

// Rate limiting (future enhancement)
@RateLimit(100, 60000) // 100 requests per minute
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

## � In-Memory Storage

Sentinel now uses in-memory storage for lightweight operation without database dependencies:

### API Key Storage

- Keys are stored in memory using a `Map<string, ApiKeyRecord>`
- Automatic cleanup of expired keys during validation
- Thread-safe operations for concurrent access
- Keys persist only for application lifetime

### Traffic Logging

- Recent traffic logs kept in memory (configurable limit)
- Automatic rotation when limit exceeded (FIFO)
- Real-time statistics calculation
- Custom handlers for external persistence

### Access Events

- Security events stored temporarily in memory
- Configurable retention for recent events
- Immediate custom handler invocation
- Statistical analysis available

### Data Structures

```typescript
interface ApiKeyRecord {
  id: string;
  name: string;
  key: string; // Hashed
  ownerType: "user" | "service";
  ownerId: string;
  scopes: string[];
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

interface TrafficLogData {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  ipVersion: "ipv4" | "ipv6";
  clientMac?: string;
  apiKeyId?: string;
  serviceId?: string;
  userId?: string;
  requestHeaders: Record<string, any>;
  responseSize?: number;
  routeName?: string;
}

interface AccessEventData {
  decision: "allow" | "deny";
  reason: string;
  ip: string;
  clientMac?: string;
  apiKeyId?: string;
  ruleMeta?: Record<string, any>;
  timestamp?: Date;
}
```

## 🚀 Performance Optimization

### Memory-Based Architecture

Sentinel is designed for high performance with minimal overhead:

- **Zero Database Latency** - All operations use in-memory storage
- **Configurable Memory Limits** - Automatic cleanup prevents memory leaks
- **Efficient Data Structures** - Maps and arrays for O(1) and O(log n) operations
- **Lazy Cleanup** - Expired keys removed during validation

### Memory Management

- **Bounded Collections** - Configurable limits for logs and events (default: 1000 items)
- **FIFO Rotation** - Oldest entries automatically removed when limits exceeded
- **Garbage Collection Friendly** - No circular references or memory leaks
- **Process Exit Safe** - Clean shutdown without hanging references

### Performance Tips

```typescript
// Configure memory limits based on your needs
class CustomLoggingService extends MemoryLoggingService {
  private readonly maxLogEntries = 5000; // Increase for high-traffic apps
}

// Use custom handlers for persistence without blocking
SentinelModule.register({
  onTrafficLog: async (logData) => {
    // Non-blocking async persistence
    setImmediate(() => {
      persistenceService.saveTrafficLog(logData);
    });
  },
});

// Batch API key creation for better performance
const keys = await Promise.all([
  apiKeyService.createKey("service", "service-1", ["read"]),
  apiKeyService.createKey("service", "service-2", ["write"]),
  apiKeyService.createKey("service", "service-3", ["admin"]),
]);
```

## 🔍 Monitoring & Analytics

### Built-in Statistics

```typescript
// Inject the MemoryLoggingService
constructor(
  private loggingService: MemoryLoggingService,
  private apiKeyService: MemoryApiKeyService
) {}

// Get comprehensive traffic stats
const trafficStats = this.loggingService.getTrafficStats();
console.log({
  totalRequests: trafficStats.totalRequests,
  uniqueIps: trafficStats.uniqueIps,
  averageResponseTime: trafficStats.averageResponseTime,
  statusCodes: trafficStats.statusCodeDistribution,
  topEndpoints: trafficStats.topEndpoints
});

// Get security event statistics
const securityStats = this.loggingService.getAccessEventStats();
console.log({
  totalEvents: securityStats.totalEvents,
  allowedEvents: securityStats.allowedEvents,
  deniedEvents: securityStats.deniedEvents,
  topDeniedReasons: securityStats.topDeniedReasons
});

// Get recent activity
const recentLogs = this.loggingService.getRecentTrafficLogs(50);
const recentEvents = this.loggingService.getRecentAccessEvents(25);

// Get API key information
const allKeys = this.apiKeyService.getAllKeys();
const activeKeys = allKeys.filter(key => key.isActive);
```

### Real-time Monitoring Setup

```typescript
@Injectable()
export class MonitoringService {
  constructor(
    private loggingService: MemoryLoggingService,
    private apiKeyService: MemoryApiKeyService
  ) {
    // Set up periodic monitoring
    setInterval(() => {
      this.generateReport();
    }, 60000); // Every minute
  }

  private generateReport() {
    const trafficStats = this.loggingService.getTrafficStats();
    const securityStats = this.loggingService.getAccessEventStats();
    const keyCount = this.apiKeyService.getAllKeys().length;

    // Send to your monitoring system
    this.sendToMonitoring({
      traffic: trafficStats,
      security: securityStats,
      apiKeys: { total: keyCount },
    });
  }
}
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

### Issue: Memory Usage in High-Traffic Applications

```typescript
// Solution: Configure memory limits and use custom handlers
SentinelModule.register({
  // Implement custom logging for persistence
  onTrafficLog: async (logData) => {
    // Save to your database/logging system
    await yourLoggingSystem.save(logData);
  },

  onAccessEvent: async (event) => {
    if (event.decision === "deny") {
      // Immediate security alerting
      await securityService.alert(event);
    }
  },
});

// Custom service with smaller memory footprint
@Injectable()
export class OptimizedLoggingService extends MemoryLoggingService {
  private readonly maxLogEntries = 100; // Smaller memory footprint
}
```

### Issue: API Key Validation Performance

```typescript
// Solution: Use custom validator with caching
const keyCache = new Map<string, { valid: boolean; expires: number }>();

SentinelModule.register({
  validateApiKey: async (key, requiredScopes) => {
    // Check cache first
    const cached = keyCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return { valid: cached.valid };
    }

    // Your validation logic
    const result = await yourValidationService.validate(key, requiredScopes);

    // Cache for 5 minutes
    keyCache.set(key, {
      valid: result.valid,
      expires: Date.now() + 300000,
    });

    return result;
  },
});
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

## 🔄 Migration & Integration

### Migrating from Database-based Systems

```typescript
// If you're migrating from a database-based auth system
@Injectable()
export class MigrationService {
  constructor(private apiKeyService: MemoryApiKeyService) {}

  async migrateFromDatabase() {
    // Load existing API keys from your database
    const existingKeys = await yourDatabase.getApiKeys();

    // Migrate to in-memory storage
    for (const key of existingKeys) {
      await this.apiKeyService.createKey(
        key.ownerType,
        key.ownerId,
        key.scopes,
        key.name,
        key.expiresAt
      );
    }
  }
}
```

### Integration with External Systems

```typescript
// Connect to external authentication providers
SentinelModule.register({
  validateApiKey: async (key, requiredScopes) => {
    // Validate against external OAuth provider
    const result = await oauthProvider.validateToken(key);
    if (!result.valid) return { valid: false };

    // Check scopes against external system
    const hasScopes = requiredScopes?.every((scope) =>
      result.scopes.includes(scope)
    );

    return {
      valid: hasScopes,
      apiKeyRecord: {
        id: result.userId,
        name: result.username,
        ownerType: "user",
        ownerId: result.userId,
        scopes: result.scopes,
        isActive: true,
        createdAt: new Date(result.issuedAt),
      },
    };
  },
});
```

### Version Compatibility

- **NestJS**: 10.x and 11.x supported
- **Node.js**: 16+ required
- **TypeScript**: 4.7+ recommended
- **Zero database dependencies** - works with any storage solution

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/rastaweb/nest-sentinel.git
cd nest-sentinel

# Install dependencies
npm install

# Run tests (no database setup required!)
npm test

# Run with coverage
npm run test:cov

# Lint code
npm run lint

# Build
npm run build

# Test with a sample project
npm link
cd ../your-project
npm link @rastaweb/nest-sentinel
```

### Testing Your Integration

```typescript
// Example test setup
describe("Sentinel Integration", () => {
  let app: INestApplication;
  let apiKeyService: MemoryApiKeyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SentinelModule.register({
          globalPolicy: {
            requireApiKey: true,
          },
        }),
      ],
    }).compile();

    app = module.createNestApplication();
    apiKeyService = module.get(MemoryApiKeyService);
    await app.init();
  });

  it("should protect routes with API keys", async () => {
    // Create a test API key
    const { rawKey } = await apiKeyService.createKey(
      "service",
      "test-service",
      ["read"]
    );

    // Test with valid key
    const response = await request(app.getHttpServer())
      .get("/protected")
      .set("x-api-key", rawKey)
      .expect(200);
  });

  afterEach(async () => {
    // Memory is automatically cleared on app shutdown
    await app.close();
  });
});
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

## 🎯 Quick Example

Here's a complete minimal example:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { SentinelModule } from "@rastaweb/nest-sentinel";
import { AppController } from "./app.controller";

@Module({
  imports: [
    SentinelModule.register({
      globalPolicy: {
        ipWhitelist: ["127.0.0.1", "::1"], // Allow localhost
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}

// app.controller.ts
import { Controller, Get, UseGuards, UseInterceptors } from "@nestjs/common";
import {
  AccessGuard,
  TrackTrafficInterceptor,
  AccessRule,
  MemoryApiKeyService,
} from "@rastaweb/nest-sentinel";

@Controller()
@UseGuards(AccessGuard)
@UseInterceptors(TrackTrafficInterceptor)
export class AppController {
  constructor(private apiKeyService: MemoryApiKeyService) {}

  @Get()
  getHello() {
    return { message: "Hello World!" };
  }

  @Get("protected")
  @AccessRule({ require: { apiKey: true } })
  getProtected() {
    return { message: "Protected data" };
  }

  @Get("admin")
  @AccessRule({
    require: { apiKey: true, scopes: ["admin"] },
    allow: ["192.168.1.0/24"],
  })
  getAdmin() {
    return { message: "Admin only" };
  }

  // Create API keys programmatically
  @Get("create-key")
  async createKey() {
    const { rawKey } = await this.apiKeyService.createKey(
      "service",
      "my-app",
      ["read", "admin"],
      "My App Key"
    );
    return { apiKey: rawKey };
  }
}
```

That's it! No database setup, no migrations, no complex configuration. Just install and use! 🚀

---

Built with ❤️ by [Rastaweb](https://github.com/rastaweb)
