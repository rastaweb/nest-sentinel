# Nest Sentinel - Developer Documentation

This document provides comprehensive technical documentation for developers working on or extending the Nest Sentinel library.

## 📁 Project Structure

```
src/
├── index.ts                           # Main export file
├── sentinel.module.ts                 # NestJS module definition
├── cli/
│   └── index.ts                      # Command-line interface
├── client/
│   └── index.ts                      # HTTP client for protected APIs
├── decorators/
│   └── access-rule.decorator.ts      # Access control decorators
├── entities/                         # TypeORM entities
│   ├── index.ts
│   ├── api-key.entity.ts            # API key storage
│   ├── traffic-log.entity.ts        # Request/response logs
│   └── access-event.entity.ts       # Security event logs
├── guards/
│   └── access.guard.ts              # Main access control guard
├── interceptors/
│   └── track-traffic.interceptor.ts # Traffic logging interceptor
├── interfaces/
│   └── index.ts                     # TypeScript interfaces and types
├── services/
│   ├── api-key.service.ts          # API key management
│   ├── traffic.service.ts          # Traffic and event logging
│   └── __tests__/                  # Service unit tests
└── utils/
    ├── network.util.ts             # Network utilities
    └── network.util.spec.ts        # Network utility tests
```

## 🏗️ Architecture Overview

### Core Components

1. **SentinelModule**: Main NestJS module that provides dependency injection and configuration
2. **AccessGuard**: CanActivate guard that enforces access rules
3. **TrackTrafficInterceptor**: NestInterceptor that logs requests/responses
4. **ApiKeyService**: Manages API key lifecycle (CRUD operations)
5. **TrafficService**: Handles traffic and access event logging with queued processing

### Data Flow

```
Request → AccessGuard → Controller → TrackTrafficInterceptor → Response
    ↓           ↓               ↓
AccessEvent  ApiKeyValidation  TrafficLog
    ↓           ↓               ↓
   Queue   AccessContext      Queue
    ↓           ↓               ↓
 Database   req.accessContext Database
```

### Configuration System

The library uses a hierarchical configuration system:

1. **Global Options**: Set in `SentinelModule.register()`
2. **Route-Level Options**: Set via `@AccessRule()` decorator
3. **Skip Decorators**: Fine-grained control via `@SkipSentinel()`, etc.

## 🧠 Core Logic Analysis

### Access Control Decision Tree

```typescript
// AccessGuard.canActivate() decision flow:
1. Check global skip configuration
2. Check route-specific skip decorators
3. Extract client information (IP, MAC)
4. Apply access rules in order:
   a. IP version requirements
   b. Deny rules (takes precedence)
   c. Allow rules
   d. API key requirements
   e. Combined requirements
5. Log access decision
6. Return allow/deny result
```

### API Key Validation Flow

```typescript
// ApiKeyService.validateKey() process:
1. Retrieve all active API keys
2. Hash compare provided key against stored keys
3. Check expiration
4. Validate required scopes
5. Update last used timestamp
6. Return validation result with access context
```

### Traffic Logging Architecture

The library uses a queue-based approach for performance:

```typescript
// Queue Processing Flow:
Request → LogData → Queue → Batch Processor → Database
          ↓
    Max 100 items → Immediate Processing
          ↓
    Every 5 seconds → Scheduled Processing
          ↓
    Retention Policy → Automatic Cleanup
```

## 🔧 Extension Points

### 1. Custom Access Rules

Add new access rule types by extending the `AccessRuleOptions` interface:

```typescript
// interfaces/index.ts
interface AccessRuleOptions {
  // Existing options...

  // New custom rule
  customRule?: {
    geoLocation?: string[];
    timeBasedAccess?: {
      allowedHours: [number, number];
      timezone: string;
    };
    rateLimiting?: {
      requestsPerMinute: number;
      windowMs: number;
    };
  };
}
```

Implement the logic in `AccessGuard`:

```typescript
// guards/access.guard.ts
private async evaluateCustomRules(
  request: Request,
  clientInfo: ClientInfo,
  customRule?: CustomRuleOptions
): Promise<AccessDecision> {
  if (customRule?.geoLocation) {
    const clientCountry = await this.geoService.getCountry(clientInfo.ip);
    if (!customRule.geoLocation.includes(clientCountry)) {
      return {
        decision: 'deny',
        reason: `Access from ${clientCountry} not allowed`,
        ruleMeta: { rule: 'geoLocation', allowedCountries: customRule.geoLocation }
      };
    }
  }

  // Time-based access
  if (customRule?.timeBasedAccess) {
    const currentHour = new Date().getHours();
    const [startHour, endHour] = customRule.timeBasedAccess.allowedHours;
    if (currentHour < startHour || currentHour > endHour) {
      return {
        decision: 'deny',
        reason: `Access only allowed between ${startHour}:00 and ${endHour}:00`,
        ruleMeta: { rule: 'timeBasedAccess', currentHour, allowedWindow: [startHour, endHour] }
      };
    }
  }

  return { decision: 'allow', reason: 'Custom rules passed' };
}
```

### 2. Custom Authentication Providers

Extend authentication beyond API keys:

```typescript
// interfaces/index.ts
interface AuthProvider {
  name: string;
  validateCredentials(request: Request): Promise<{
    valid: boolean;
    context?: AccessContext;
    error?: string;
  }>;
}

// services/auth-provider.service.ts
@Injectable()
export class JwtAuthProvider implements AuthProvider {
  name = "jwt";

  async validateCredentials(request: Request) {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return { valid: false, error: "JWT token required" };
    }

    try {
      const payload = jwt.verify(token, this.configService.get("JWT_SECRET"));
      return {
        valid: true,
        context: {
          ownerId: payload.sub,
          ownerType: "user",
          scopes: payload.scopes || [],
        },
      };
    } catch (error) {
      return { valid: false, error: "Invalid JWT token" };
    }
  }
}
```

### 3. Custom Logging Adapters

Add different logging backends:

```typescript
// interfaces/index.ts
interface LoggingAdapter {
  logTraffic(data: TrafficLogData): Promise<void>;
  logAccessEvent(event: AccessEventData): Promise<void>;
  queryLogs(options: QueryLogsOptions): Promise<TrafficLog[]>;
}

// adapters/elasticsearch-logging.adapter.ts
@Injectable()
export class ElasticsearchLoggingAdapter implements LoggingAdapter {
  constructor(private elasticsearch: ElasticsearchService) {}

  async logTraffic(data: TrafficLogData): Promise<void> {
    await this.elasticsearch.index({
      index: "sentinel-traffic",
      body: {
        ...data,
        "@timestamp": new Date().toISOString(),
      },
    });
  }

  async logAccessEvent(event: AccessEventData): Promise<void> {
    await this.elasticsearch.index({
      index: "sentinel-access",
      body: {
        ...event,
        "@timestamp": new Date().toISOString(),
      },
    });
  }

  async queryLogs(options: QueryLogsOptions): Promise<TrafficLog[]> {
    // Implement Elasticsearch query logic
  }
}
```

### 4. Custom Network Utilities

Extend network utility functions:

```typescript
// utils/network.util.ts

/**
 * Advanced CIDR matching with IPv6 support
 */
export function advancedCidrMatch(ip: string, cidr: string): boolean {
  try {
    const addr = ipaddr.process(ip);
    const range = ipaddr.process(cidr);
    return addr.match(range);
  } catch {
    return false;
  }
}

/**
 * Geolocation-based matching
 */
export async function matchByGeoLocation(
  ip: string,
  allowedCountries: string[]
): Promise<boolean> {
  try {
    const geoData = await fetch(`https://ipapi.co/${ip}/json/`);
    const { country_code } = await geoData.json();
    return allowedCountries.includes(country_code);
  } catch {
    return false;
  }
}

/**
 * ASN (Autonomous System Number) based filtering
 */
export async function matchByASN(
  ip: string,
  allowedASNs: number[]
): Promise<boolean> {
  try {
    const geoData = await fetch(`https://ipapi.co/${ip}/json/`);
    const { asn } = await geoData.json();
    return allowedASNs.includes(parseInt(asn));
  } catch {
    return false;
  }
}
```

## 🧪 Testing Strategy

### Unit Tests

Each service and utility has comprehensive unit tests:

```typescript
// Example test structure
describe("ApiKeyService", () => {
  let service: ApiKeyService;
  let repository: MockRepository<ApiKey>;

  beforeEach(async () => {
    // Setup test module with mocked dependencies
  });

  describe("createKey", () => {
    it("should create API key with correct properties", async () => {
      // Test implementation
    });

    it("should handle duplicate key generation", async () => {
      // Test collision handling
    });
  });

  describe("validateKey", () => {
    it("should validate correct API key", async () => {
      // Test validation logic
    });

    it("should reject expired keys", async () => {
      // Test expiration logic
    });
  });
});
```

### Integration Tests

Test the complete flow:

```typescript
describe("AccessGuard Integration", () => {
  let app: INestApplication;
  let guard: AccessGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SentinelModule.register({
          /* test config */
        }),
      ],
      controllers: [TestController],
    }).compile();

    app = module.createNestApplication();
    guard = module.get<AccessGuard>(AccessGuard);
  });

  it("should allow access with valid API key", async () => {
    // Create test API key
    // Make request with key
    // Assert successful access
  });

  it("should deny access from blocked IP", async () => {
    // Configure IP block rule
    // Make request from blocked IP
    // Assert access denied
  });
});
```

### Performance Tests

Monitor performance under load:

```typescript
describe("Traffic Service Performance", () => {
  it("should handle high traffic load", async () => {
    const requests = Array.from({ length: 1000 }, (_, i) => ({
      method: "GET",
      path: `/test/${i}`,
      statusCode: 200,
      durationMs: Math.random() * 100,
      ip: `192.168.1.${i % 255}`,
      ipVersion: "ipv4" as const,
      requestHeaders: {},
    }));

    const startTime = Date.now();

    // Log all requests
    await Promise.all(requests.map((req) => trafficService.logRequest(req)));

    // Wait for queue processing
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

    // Verify all logs were processed
    const logs = await trafficService.queryLogs({ limit: 1000 });
    expect(logs).toHaveLength(1000);
  });
});
```

## 📊 Monitoring & Observability

### Metrics Collection

Add metrics collection for monitoring:

```typescript
// services/metrics.service.ts
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly timers = new Map<string, number[]>();

  incrementCounter(name: string, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  recordTimer(
    name: string,
    duration: number,
    tags?: Record<string, string>
  ): void {
    const key = this.buildKey(name, tags);
    const timers = this.timers.get(key) || [];
    timers.push(duration);
    this.timers.set(key, timers);
  }

  getMetrics(): {
    counters: Record<string, number>;
    timers: Record<string, number[]>;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      timers: Object.fromEntries(this.timers),
    };
  }

  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagString = Object.entries(tags)
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}{${tagString}}`;
  }
}
```

### Health Checks

Implement health monitoring:

```typescript
// health/sentinel.health.ts
@Injectable()
export class SentinelHealthIndicator extends HealthIndicator {
  constructor(
    private apiKeyService: ApiKeyService,
    private trafficService: TrafficService
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check API key service
      const testKey = await this.apiKeyService.validateKey("test-key");

      // Check traffic service queue size
      const queueSize = this.trafficService.getQueueSize();

      const isHealthy = queueSize < 1000; // Queue not overwhelmed

      const result = this.getStatus(key, isHealthy, {
        queueSize,
        timestamp: new Date().toISOString(),
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError("Sentinel service degraded", result);
    } catch (error) {
      throw new HealthCheckError("Sentinel service unavailable", {
        [key]: {
          status: "down",
          error: error.message,
        },
      });
    }
  }
}
```

## 🔄 Migration Strategies

### Database Schema Migrations

For production deployments with existing data:

```typescript
// migrations/001-add-new-column.ts
import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddNewColumn1700000000000 implements MigrationInterface {
  name = "AddNewColumn1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "api_keys",
      new TableColumn({
        name: "newFeatureFlag",
        type: "boolean",
        default: false,
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("api_keys", "newFeatureFlag");
  }
}
```

### Version Compatibility

Handle breaking changes:

```typescript
// version-compatibility.service.ts
@Injectable()
export class VersionCompatibilityService {
  private readonly version = "1.2.1";

  async checkCompatibility(): Promise<boolean> {
    // Check database schema version
    // Validate configuration format
    // Ensure backward compatibility
    return true;
  }

  async migrate(fromVersion: string, toVersion: string): Promise<void> {
    const migrations = this.getMigrationPlan(fromVersion, toVersion);

    for (const migration of migrations) {
      await migration.execute();
    }
  }
}
```

## 🚀 Performance Optimization

### Queue Optimization

```typescript
// Optimized queue processing
class OptimizedQueue<T> {
  private queue: T[] = [];
  private processing = false;
  private readonly maxBatchSize: number;
  private readonly flushInterval: number;

  constructor(
    private processor: (items: T[]) => Promise<void>,
    options: { maxBatchSize?: number; flushInterval?: number } = {}
  ) {
    this.maxBatchSize = options.maxBatchSize || 50;
    this.flushInterval = options.flushInterval || 5000;
    this.startProcessor();
  }

  add(item: T): void {
    this.queue.push(item);

    // Immediate processing for large queues
    if (this.queue.length >= this.maxBatchSize) {
      this.process();
    }
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      const batch = this.queue.splice(0, this.maxBatchSize);
      await this.processor(batch);
    } catch (error) {
      console.error("Queue processing error:", error);
    } finally {
      this.processing = false;
    }
  }

  private startProcessor(): void {
    setInterval(() => this.process(), this.flushInterval);
  }
}
```

### Memory Management

```typescript
// Memory-efficient logging
class MemoryEfficientLogger {
  private readonly maxMemoryUsage = 100 * 1024 * 1024; // 100MB
  private currentMemoryUsage = 0;

  logRequest(data: TrafficLogData): void {
    const dataSize = this.estimateSize(data);

    if (this.currentMemoryUsage + dataSize > this.maxMemoryUsage) {
      this.flush(); // Force immediate processing
    }

    this.queue.add(data);
    this.currentMemoryUsage += dataSize;
  }

  private estimateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimation
  }

  private flush(): void {
    // Force immediate queue processing
    this.currentMemoryUsage = 0;
  }
}
```

## 🐛 Debugging Guide

### Common Issues

1. **TypeORM Connection Issues**
   - Check database URL format
   - Verify entity imports
   - Ensure proper module loading order

2. **API Key Validation Failures**
   - Verify bcrypt comparison
   - Check header name configuration
   - Validate key format

3. **Access Rule Conflicts**
   - Deny rules take precedence over allow rules
   - Check rule evaluation order
   - Validate IP/CIDR formats

### Debug Logging

Enable comprehensive logging:

```typescript
// Enable debug logging
SentinelModule.register({
  enableLogs: true,
  debug: true, // Add this option
  logLevel: "verbose",
});

// Or use environment variable
process.env.SENTINEL_DEBUG = "true";
```

### Troubleshooting Tools

```typescript
// Add debugging utility
export class SentinelDebugger {
  static analyzeRequest(request: Request): DebugInfo {
    return {
      headers: request.headers,
      ip: parseClientIp(request),
      route: request.route?.path,
      method: request.method,
      timestamp: new Date().toISOString(),
    };
  }

  static validateAccessRule(rule: AccessRuleOptions): ValidationResult {
    // Validate rule syntax and logic
    return { valid: true, warnings: [], errors: [] };
  }

  static traceAccessDecision(
    clientInfo: ClientInfo,
    rules: AccessRuleOptions
  ): DecisionTrace {
    // Step-by-step decision tracing
    return {
      steps: [],
      finalDecision: "allow",
      matchedRules: [],
    };
  }
}
```

## 📚 Additional Resources

### Useful TypeORM Patterns

```typescript
// Custom repository patterns for complex queries
@Injectable()
export class CustomTrafficRepository {
  constructor(
    @InjectRepository(TrafficLog)
    private repository: Repository<TrafficLog>
  ) {}

  async getTrafficByPattern(pattern: {
    timeRange: [Date, Date];
    ipPattern?: string;
    statusCodes?: number[];
  }): Promise<TrafficLog[]> {
    const qb = this.repository.createQueryBuilder("traffic");

    qb.where("traffic.timestamp BETWEEN :start AND :end", {
      start: pattern.timeRange[0],
      end: pattern.timeRange[1],
    });

    if (pattern.ipPattern) {
      qb.andWhere("traffic.ip LIKE :ipPattern", {
        ipPattern: `${pattern.ipPattern}%`,
      });
    }

    if (pattern.statusCodes) {
      qb.andWhere("traffic.statusCode IN (:...codes)", {
        codes: pattern.statusCodes,
      });
    }

    return qb.getMany();
  }
}
```

### Security Considerations

1. **SQL Injection Prevention**: Always use parameterized queries
2. **Timing Attacks**: Use constant-time comparison for sensitive operations
3. **Rate Limiting**: Implement rate limiting for API key creation
4. **Audit Logging**: Maintain immutable audit trails
5. **Key Storage**: Never log raw API keys, always use hashed versions

### Performance Benchmarks

Target performance metrics:

- API key validation: < 10ms
- Access rule evaluation: < 5ms
- Traffic log queuing: < 1ms
- Database operations: < 50ms
- Queue processing: < 100ms for 50 items

This documentation should serve as a comprehensive guide for developers working on or extending the Nest Sentinel library. Regular updates should be made as new features are added or architectural changes are implemented.
