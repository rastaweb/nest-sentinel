# @rastaweb/nest-sentinel - Complete Configuration Guide

This guide demonstrates all configuration options and skip patterns available in Sentinel, following SOLID principles and providing granular control over security features.

## 📋 Table of Contents

1. [Global Configuration](#global-configuration)
2. [Route-Level Skip Controls](#route-level-skip-controls)
3. [Access Rule Configuration](#access-rule-configuration)
4. [Complete Examples](#complete-examples)
5. [Best Practices](#best-practices)

---

## 🌍 Global Configuration

### Full Global Configuration

```typescript
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  SentinelModule,
  ApiKey,
  TrafficLog,
  AccessEvent,
} from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "mysql",
      host: "localhost",
      port: 3306,
      username: "user",
      password: "password",
      database: "myapp",
      entities: [
        __dirname + "/**/*.entity{.ts,.js}",
        ApiKey,
        TrafficLog,
        AccessEvent,
      ],
      synchronize: true,
    }),

    SentinelModule.register({
      // Global Skip Options (NEW in v1.1.0)
      skipGlobalGuards: false, // Skip ALL access guards globally
      skipTrafficLogging: false, // Skip ALL traffic logging globally
      skipAccessLogging: false, // Skip ALL access event logging globally

      // Core Configuration
      autoMigrate: true,
      enableLogs: true,
      apiKeyHeader: "x-api-key",
      clientMacHeader: "x-client-mac",
      trustProxy: true,
      trafficRetentionDays: 90,

      // Global Security Policy
      globalPolicy: {
        ipWhitelist: ["10.0.0.0/8", "192.168.0.0/16"],
        requireApiKey: false,
        allowedMacs: ["00-14-22-01-23-45"],
        deniedIps: ["192.168.1.100"],
      },

      // Service Authentication
      serviceAuth: {
        enabled: true,
        requiredScopes: ["internal"],
      },

      // Custom User Identification
      identifyUserFromRequest: async (req) => {
        const userId = req.headers["x-user-id"];
        const serviceId = req.headers["x-service-id"];
        return { userId, serviceId };
      },
    }),
  ],
})
export class AppModule {}
```

### Global Skip Configurations

```typescript
// Development - Skip everything
SentinelModule.register({
  skipGlobalGuards: true, // No access control
  skipTrafficLogging: true, // No traffic logs
  skipAccessLogging: true, // No access events
});

// Production - Minimal logging
SentinelModule.register({
  skipGlobalGuards: false, // Keep access control
  skipTrafficLogging: true, // Skip traffic logs (performance)
  skipAccessLogging: false, // Keep access events (security)
});

// High-Performance - Guards only
SentinelModule.register({
  skipGlobalGuards: false, // Keep access control
  skipTrafficLogging: true, // Skip traffic logs
  skipAccessLogging: true, // Skip access events
});
```

---

## 🛡️ Route-Level Skip Controls

### Using Skip Decorators (Similar to @SkipThrottle)

```typescript
import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  AccessGuard,
  SkipSentinel, // Skip access guard only
  SkipTrafficLogging, // Skip traffic logging only
  SkipAccessLogging, // Skip access event logging only
  SkipAllSentinel, // Skip everything
  RequireApiKey,
  AllowIps,
} from "@rastaweb/nest-sentinel";

@Controller("api")
@UseGuards(AccessGuard)
export class ApiController {
  // Standard protected endpoint
  @Get("protected")
  @RequireApiKey(["read"])
  protected() {
    return { message: "This is protected" };
  }

  // Skip access guard entirely (similar to @SkipThrottle)
  @Get("public")
  @SkipSentinel()
  public() {
    return { message: "No access control applied" };
  }

  // Keep access control but skip traffic logging (performance)
  @Get("fast")
  @RequireApiKey(["read"])
  @SkipTrafficLogging()
  fast() {
    return { message: "Protected but no traffic logging" };
  }

  // Keep access control but skip access event logging
  @Get("quiet")
  @RequireApiKey(["read"])
  @SkipAccessLogging()
  quiet() {
    return { message: "Protected but no access events logged" };
  }

  // Skip all Sentinel features
  @Get("unrestricted")
  @SkipAllSentinel()
  unrestricted() {
    return { message: "No Sentinel features applied" };
  }

  // Complex rule with selective skipping
  @Post("admin")
  @RequireApiKey(["admin"])
  @AllowIps(["10.0.0.0/8"])
  @SkipTrafficLogging() // Admin endpoint - skip heavy logging
  admin() {
    return { message: "Admin action with minimal logging" };
  }
}
```

### Using AccessRule Configuration

```typescript
import { AccessRule } from "@rastaweb/nest-sentinel";

@Controller("advanced")
export class AdvancedController {
  // Configure skip options via AccessRule
  @Get("selective")
  @AccessRule({
    require: { apiKey: true, scopes: ["read"] },
    allow: ["192.168.1.0/24"],
    skipTrafficLogging: true, // Skip traffic logs
    skipAccessLogging: false, // Keep access events
    note: "Internal API with selective logging",
  })
  selective() {
    return { message: "Custom skip configuration" };
  }

  // Skip guard entirely via AccessRule
  @Get("bypass")
  @AccessRule({
    skipGuard: true, // Skip entire guard
    note: "Emergency bypass endpoint",
  })
  bypass() {
    return { message: "No access control" };
  }

  // Complex access rule with multiple skip options
  @Post("complex")
  @AccessRule({
    allow: [
      "10.0.0.0/8",
      { anyOf: ["192.168.1.0/24", "MAC:00-14-22-01-23-45"] },
    ],
    require: { apiKey: true, scopes: ["admin", "write"] },
    ipVersion: "ipv4",
    skipTrafficLogging: true, // Performance optimization
    skipAccessLogging: false, // Security audit trail
    note: "Admin endpoint with optimized logging",
  })
  complex() {
    return { message: "Complex rules with selective features" };
  }
}
```

---

## 🎯 Access Rule Configuration

### Complete Access Rule Options

```typescript
interface AccessRuleOptions {
  // Access Control
  allow?: Array<string | AddressMatch>;
  deny?: Array<string | AddressMatch>;
  require?: {
    apiKey?: boolean;
    scopes?: string[];
    combined?: Array<"ip" | "mac" | "apiKey" | "ipVersion">;
  };
  ipVersion?: "ipv4" | "ipv6" | "any";

  // Skip Options (NEW in v1.1.0)
  skipGuard?: boolean; // Skip access guard for this route
  skipTrafficLogging?: boolean; // Skip traffic logging for this route
  skipAccessLogging?: boolean; // Skip access event logging for this route

  // Documentation
  note?: string;
}
```

### Address Matching Examples

```typescript
@Controller("network")
export class NetworkController {
  // Simple IP whitelist
  @Get("simple")
  @AccessRule({
    allow: ["192.168.1.100", "10.0.0.1"],
    skipTrafficLogging: true,
  })
  simple() {
    return { message: "Simple IP whitelist" };
  }

  // CIDR ranges
  @Get("cidr")
  @AccessRule({
    allow: ["10.0.0.0/8", "192.168.0.0/16"],
    deny: ["192.168.1.100"],
    skipAccessLogging: true,
  })
  cidr() {
    return { message: "CIDR-based access control" };
  }

  // Complex address matching
  @Get("complex")
  @AccessRule({
    allow: [
      "10.0.0.0/8",
      { anyOf: ["192.168.1.0/24", "MAC:00-14-22-01-23-45"] },
      { allOf: ["172.16.0.0/12", "MAC:00-14-22-01-23-46"] },
    ],
    require: {
      combined: ["ip", "apiKey"],
      scopes: ["internal"],
    },
    skipTrafficLogging: true,
    note: "Complex network access with API key requirement",
  })
  complex() {
    return { message: "Complex address matching" };
  }
}
```

---

## 🏗️ Complete Examples

### High-Performance Microservice

```typescript
// High-performance setup - minimal logging
@Module({
  imports: [
    TypeOrmModule.forRoot({
      /* ... */
    }),
    SentinelModule.register({
      skipTrafficLogging: true, // Performance: Skip heavy traffic logs
      skipAccessLogging: false, // Security: Keep access events
      globalPolicy: {
        requireApiKey: true,
        ipWhitelist: ["10.0.0.0/8"],
      },
    }),
  ],
})
export class HighPerformanceModule {}

@Controller("api")
@UseGuards(AccessGuard)
export class HighPerformanceController {
  @Get("data")
  @RequireApiKey(["read"])
  // No traffic logging globally, only access events
  getData() {
    return { data: "Fast response" };
  }

  @Get("public/health")
  @SkipAllSentinel() // Health check - no overhead
  health() {
    return { status: "ok" };
  }
}
```

### Security-First Application

```typescript
// Security-focused setup - full logging
@Module({
  imports: [
    TypeOrmModule.forRoot({
      /* ... */
    }),
    SentinelModule.register({
      skipGlobalGuards: false, // Always check access
      skipTrafficLogging: false, // Full audit trail
      skipAccessLogging: false, // Security events
      globalPolicy: {
        requireApiKey: true,
        ipWhitelist: ["192.168.1.0/24"],
      },
      serviceAuth: {
        enabled: true,
        requiredScopes: ["internal"],
      },
    }),
  ],
})
export class SecurityModule {}

@Controller("secure")
@UseGuards(AccessGuard)
export class SecurityController {
  @Post("admin")
  @RequireApiKey(["admin"])
  @AllowIps(["192.168.1.0/24"])
  // Full logging for admin actions
  adminAction() {
    return { message: "Admin action logged" };
  }

  @Get("emergency")
  @AccessRule({
    skipGuard: true,
    skipTrafficLogging: false, // Still log emergency access
    note: "Emergency bypass with audit trail",
  })
  emergency() {
    return { message: "Emergency access" };
  }
}
```

### Development Environment

```typescript
// Development setup - minimal restrictions
@Module({
  imports: [
    TypeOrmModule.forRoot({
      /* ... */
    }),
    SentinelModule.register({
      skipGlobalGuards: true, // No access control in dev
      skipTrafficLogging: true, // No performance overhead
      skipAccessLogging: true, // Clean logs
      enableLogs: false,
    }),
  ],
})
export class DevelopmentModule {}

@Controller("dev")
export class DevelopmentController {
  @Get("test")
  // Everything skipped globally
  test() {
    return { message: "Development endpoint" };
  }

  @Get("production-test")
  @AccessRule({
    require: { apiKey: true },
    skipGuard: false, // Test production-like behavior
    skipTrafficLogging: false,
    note: "Test production security locally",
  })
  productionTest() {
    return { message: "Production-like test" };
  }
}
```

---

## 🎯 Best Practices

### 1. Performance Optimization

```typescript
// Skip traffic logging for high-frequency endpoints
@Get('metrics')
@SkipTrafficLogging()
@RequireApiKey(['metrics'])
metrics() {
  return this.metricsService.getMetrics();
}

// Skip all logging for health checks
@Get('health')
@SkipAllSentinel()
health() {
  return { status: 'ok' };
}
```

### 2. Security Considerations

```typescript
// Keep access events for security-critical endpoints
@Post('admin/delete-user')
@RequireApiKey(['admin'])
@AllowIps(['192.168.1.0/24'])
@SkipTrafficLogging()      // Performance
// Keep access logging for security
deleteUser() {
  return this.userService.delete();
}
```

### 3. Environment-Specific Configuration

```typescript
// Use environment variables for global skip configuration
SentinelModule.registerAsync({
  useFactory: (configService: ConfigService) => ({
    skipGlobalGuards: configService.get("NODE_ENV") === "development",
    skipTrafficLogging: configService.get("SKIP_TRAFFIC_LOGS", false),
    skipAccessLogging: configService.get("SKIP_ACCESS_LOGS", false),
    globalPolicy: {
      requireApiKey: configService.get("REQUIRE_API_KEY", true),
    },
  }),
  inject: [ConfigService],
});
```

### 4. Layered Security Approach

```typescript
@Controller("api")
@UseGuards(AccessGuard)
export class LayeredController {
  // Public endpoint - completely skip
  @Get("public")
  @SkipAllSentinel()
  public() {}

  // Internal endpoint - basic protection
  @Get("internal")
  @AllowIps(["10.0.0.0/8"])
  @SkipTrafficLogging() // Performance optimization
  internal() {}

  // Sensitive endpoint - full protection
  @Post("sensitive")
  @RequireApiKey(["admin"])
  @AllowIps(["192.168.1.0/24"])
  // Full logging for audit
  sensitive() {}
}
```

---

## 🚀 Migration from Basic Usage

### Before (v1.0.x)

```typescript
@Controller("api")
@UseGuards(AccessGuard)
export class ApiController {
  @Get("endpoint")
  @RequireApiKey(["read"])
  endpoint() {
    // Everything always logged and checked
  }
}
```

### After (v1.1.x) - With Granular Control

```typescript
@Controller("api")
@UseGuards(AccessGuard)
export class ApiController {
  @Get("endpoint")
  @RequireApiKey(["read"])
  @SkipTrafficLogging() // Performance optimization
  endpoint() {
    // Access control + access events, no traffic logs
  }

  @Get("health")
  @SkipAllSentinel() // No overhead for health checks
  health() {
    // Completely unprotected
  }
}
```

This configuration system follows SOLID principles:

- **Single Responsibility**: Each skip option has one purpose
- **Open/Closed**: Easily extendable without modifying core guard logic
- **Liskov Substitution**: Skip decorators work consistently across all routes
- **Interface Segregation**: Granular control over each feature
- **Dependency Inversion**: Configuration drives behavior, not hardcoded logic
