![Logo](https://avatars.githubusercontent.com/u/238212114?s=48&v=4)

# @rastaweb/nest-sentinel

A comprehensive NestJS library for endpoint-level access validation with IP and API key restrictions, providing flexible configuration at both global and route levels.

[![npm version](https://badge.fury.io/js/%40rastaweb%2Fnest-sentinel.svg)](https://badge.fury.io/js/%40rastaweb%2Fnest-sentinel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🛡️ **IP Validation**: IPv4/IPv6 support with CIDR ranges, whitelist/blacklist
- 🔑 **API Key Validation**: Flexible key validation with expiration and rate limiting
- 🎯 **Route-Level Control**: Fine-grained control with decorators
- 🌐 **Global Configuration**: Apply rules globally or per-feature
- 🔧 **Extensible Strategies**: Create custom validation logic
- 📊 **Built-in Stores**: In-memory store with database integration support
- 🚀 **Production Ready**: TypeScript, comprehensive testing, environment validation
- 📖 **Well Documented**: Extensive examples and API documentation

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Advanced Configuration](#advanced-configuration)
- [Decorators](#decorators)
- [Custom Strategies](#custom-strategies)
- [Custom Stores](#custom-stores)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Migration Guide](#migration-guide)
- [Contributing](#contributing)

## Installation

```bash
npm install @rastaweb/nest-sentinel
```

### Peer Dependencies

Make sure you have the required peer dependencies:

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Quick Start

### 1. Basic Setup

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { SentinelModule } from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    SentinelModule.forRoot({
      enabled: true,
      defaultStrategy: "default",
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

### 2. Protect a Route

```typescript
// app.controller.ts
import { Controller, Get } from "@nestjs/common";
import { Sentinel, IPOnly, APIKeyOnly } from "@rastaweb/nest-sentinel";

@Controller()
export class AppController {
  @IPOnly(["192.168.0.0/24", "127.0.0.1"])
  @Get("internal")
  getInternalData() {
    return { message: "Internal data accessible only from allowed IPs" };
  }

  @APIKeyOnly()
  @Get("protected")
  getProtectedData() {
    return { message: "Protected data requiring API key" };
  }
}
```

## Basic Usage

### IP-Based Protection

```typescript
import { IPOnly, PrivateNetworkOnly, BlockIPs } from "@rastaweb/nest-sentinel";

@Controller("api")
export class ApiController {
  // Allow specific IP ranges
  @IPOnly(["192.168.0.0/24", "10.0.0.0/8"])
  @Get("internal")
  getInternalAPI() {
    return { data: "Internal API" };
  }

  // Private networks only
  @PrivateNetworkOnly()
  @Get("admin")
  getAdminPanel() {
    return { admin: true };
  }

  // Block specific IPs
  @BlockIPs(["192.168.1.100", "10.0.0.50/32"])
  @Get("public")
  getPublicAPI() {
    return { data: "Public but some IPs blocked" };
  }
}
```

### API Key Protection

```typescript
import { APIKeyOnly, RequireBoth } from "@rastaweb/nest-sentinel";

@Controller("secure")
export class SecureController {
  // Require API key in default header (x-api-key)
  @APIKeyOnly()
  @Get("data")
  getSecureData() {
    return { secure: "data" };
  }

  // Custom header for API key
  @APIKeyOnly({ header: "authorization", required: true })
  @Get("auth")
  getAuthData() {
    return { auth: "data" };
  }

  // Require both IP and API key
  @RequireBoth({
    allowedIPs: ["192.168.0.0/24"],
    apiKeyHeader: "x-api-key",
  })
  @Get("ultra-secure")
  getUltraSecureData() {
    return { ultra: "secure" };
  }
}
```

### Advanced Route Configuration

```typescript
import { Sentinel } from "@rastaweb/nest-sentinel";

@Controller("advanced")
export class AdvancedController {
  @Sentinel({
    ip: {
      type: "ip",
      whitelist: ["192.168.0.0/24"],
      blacklist: ["192.168.0.100"],
      allowPrivate: true,
      allowLoopback: true,
    },
    apiKey: {
      type: "apiKey",
      header: "x-custom-key",
      required: true,
      validateKey: true,
    },
  })
  @Get("complex")
  getComplexValidation() {
    return { message: "Complex validation passed" };
  }

  // Multiple validation rules
  @Sentinel({
    rules: [
      {
        type: "ip",
        whitelist: ["10.0.0.0/8"],
      },
      {
        type: "apiKey",
        header: "authorization",
        required: true,
      },
    ],
  })
  @Get("multi-rules")
  getMultiRuleValidation() {
    return { message: "Multiple rules validated" };
  }
}
```

## Advanced Configuration

### Async Configuration

```typescript
// app.module.ts
import { SentinelModule } from "@rastaweb/nest-sentinel";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot(),
    SentinelModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        enabled: configService.get("SENTINEL_ENABLED", true),
        defaultStrategy: configService.get("SENTINEL_STRATEGY", "default"),
        defaultIPRules: {
          type: "ip",
          allowPrivate: configService.get("ALLOW_PRIVATE_IPS", true),
          allowLoopback: configService.get("ALLOW_LOOPBACK", true),
        },
        defaultAPIKeyRules: {
          type: "apiKey",
          required: configService.get("REQUIRE_API_KEY", false),
          validateKey: true,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Production Configuration

```typescript
import {
  SentinelModule,
  createProductionConfig,
} from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    SentinelModule.forRoot(
      createProductionConfig({
        defaultIPRules: {
          type: "ip",
          allowPrivate: false, // Disable private IPs in production
          allowLoopback: false, // Disable loopback in production
        },
        defaultAPIKeyRules: {
          type: "apiKey",
          required: true, // Require API keys in production
          validateKey: true,
        },
      })
    ),
  ],
})
export class AppModule {}
```

## Decorators

### @Sentinel(options)

Main decorator for configuring route-level validation.

```typescript
@Sentinel({
  ip?: string[] | IPValidationRule,
  apiKey?: boolean | APIKeyValidationRule,
  skip?: boolean,
  rules?: ValidationRule[],
  strategy?: string
})
```

### @SkipSentinel()

Skip validation for specific routes.

```typescript
@SkipSentinel()
@Get('public')
getPublicEndpoint() {
  return { public: true };
}
```

### @IPOnly(allowedIPs)

IP-only validation.

```typescript
@IPOnly(['192.168.0.0/24', '127.0.0.1'])
@Get('ip-protected')
getIPProtected() {
  return { ipProtected: true };
}
```

### @APIKeyOnly(options?)

API key-only validation.

```typescript
@APIKeyOnly({ header: 'x-api-key', required: true })
@Get('key-protected')
getKeyProtected() {
  return { keyProtected: true };
}
```

### @PrivateNetworkOnly()

Allow private networks only.

```typescript
@PrivateNetworkOnly()
@Get('internal')
getInternalEndpoint() {
  return { internal: true };
}
```

### @BlockIPs(blockedIPs)

Block specific IPs.

```typescript
@BlockIPs(['192.168.1.100', '10.0.0.50'])
@Get('blocked-ips')
getWithBlockedIPs() {
  return { blocked: 'some IPs' };
}
```

### @RequireBoth(options)

Require both IP and API key validation.

```typescript
@RequireBoth({
  allowedIPs: ['192.168.0.0/24'],
  apiKeyHeader: 'x-api-key'
})
@Get('both-required')
getBothRequired() {
  return { both: 'required' };
}
```

### @SentinelStrategy(strategyName)

Use a specific strategy.

```typescript
@SentinelStrategy('premium')
@Get('premium')
getPremiumAccess() {
  return { premium: true };
}
```

## Custom Strategies

Create custom validation logic by extending `SentinelStrategy`:

```typescript
import { Injectable } from "@nestjs/common";
import {
  SentinelStrategy,
  ValidationContext,
  ValidationResult,
} from "@rastaweb/nest-sentinel";

@Injectable()
export class BusinessHoursStrategy extends SentinelStrategy {
  readonly name = "business-hours";

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Business hours: Monday-Friday, 9 AM - 5 PM
    const isBusinessDay = day >= 1 && day <= 5;
    const isBusinessHour = hour >= 9 && hour < 17;

    if (!isBusinessDay || !isBusinessHour) {
      return {
        allowed: false,
        reason: "Access restricted to business hours (Mon-Fri, 9 AM - 5 PM)",
        metadata: {
          currentTime: now.toISOString(),
          businessDay: isBusinessDay,
          businessHour: isBusinessHour,
        },
      };
    }

    return { allowed: true };
  }
}
```

### Register Custom Strategy

```typescript
// app.module.ts
import { SentinelModule } from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    SentinelModule.withStrategies([BusinessHoursStrategy], {
      defaultStrategy: "business-hours",
    }),
  ],
  providers: [BusinessHoursStrategy],
})
export class AppModule {}
```

### Use Custom Strategy

```typescript
@SentinelStrategy('business-hours')
@Get('business-only')
getBusinessOnlyData() {
  return { message: 'Available during business hours only' };
}
```

## Custom Stores

Implement custom storage backends by extending `SentinelStore`:

```typescript
import { Injectable } from "@nestjs/common";
import { SentinelStore } from "@rastaweb/nest-sentinel";

@Injectable()
export class DatabaseSentinelStore extends SentinelStore {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async isIPAllowed(ip: string): Promise<boolean> {
    const result = await this.database.query(
      "SELECT COUNT(*) as count FROM allowed_ips WHERE ip = ? OR ? INET_ATON(ip) & INET_ATON(mask)",
      [ip, ip]
    );
    return result[0].count > 0;
  }

  async isAPIKeyValid(key: string): Promise<boolean> {
    const result = await this.database.query(
      "SELECT COUNT(*) as count FROM api_keys WHERE key_hash = SHA2(?, 256) AND active = 1",
      [key]
    );
    return result[0].count > 0;
  }

  async getAPIKeyMetadata(key: string): Promise<Record<string, any> | null> {
    const result = await this.database.query(
      "SELECT * FROM api_keys WHERE key_hash = SHA2(?, 256) AND active = 1",
      [key]
    );
    return result[0] || null;
  }

  // Implement other required methods...
}
```

### Register Custom Store

```typescript
// app.module.ts
import { SentinelModule } from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    SentinelModule.withStore(DatabaseSentinelStore, {
      defaultStrategy: "default",
    }),
  ],
  providers: [DatabaseSentinelStore, DatabaseService],
})
export class AppModule {}
```

## Environment Variables

Sentinel supports environment-based configuration:

```bash
# .env file
SENTINEL_ENABLED=true
SENTINEL_DEFAULT_STRATEGY=default
SENTINEL_LOG_LEVEL=info
SENTINEL_RATE_LIMIT_WINDOW=3600
SENTINEL_RATE_LIMIT_MAX=1000
```

Environment validation is automatic when `envValidation: true` (default).

## API Reference

### Interfaces

#### SentinelConfig

```typescript
interface SentinelConfig {
  enabled?: boolean;
  defaultStrategy?: string;
  defaultIPRules?: IPValidationRule;
  defaultAPIKeyRules?: APIKeyValidationRule;
  globalRules?: ValidationRule[];
  envValidation?: boolean;
}
```

#### ValidationContext

```typescript
interface ValidationContext {
  clientIP: string;
  apiKey?: string;
  headers: Record<string, string | string[]>;
  query: Record<string, any>;
  routeOptions?: SentinelOptions;
  userAgent?: string;
  metadata?: Record<string, any>;
}
```

#### ValidationResult

```typescript
interface ValidationResult {
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}
```

### Utilities

#### IPValidator

```typescript
class IPValidator {
  static isValidIP(ip: string): boolean;
  static isIPv4(ip: string): boolean;
  static isIPv6(ip: string): boolean;
  static isPrivateIP(ip: string): boolean;
  static isLoopbackIP(ip: string): boolean;
  static isIPInRange(ip: string, range: string): boolean;
  static validateIP(ip: string, options: IPValidationOptions): ValidationResult;
  static extractClientIP(headers: Record<string, string | string[]>): string;
}
```

#### APIKeyValidator

```typescript
class APIKeyValidator {
  static extractAPIKey(
    headers: Record<string, any>,
    query: Record<string, any>,
    options?: APIKeyOptions
  ): string | null;
  static isValidFormat(apiKey: string): boolean;
  static isExpired(metadata: Record<string, any>): boolean;
  static validateWithMetadata(
    apiKey: string,
    metadata: Record<string, any> | null
  ): ValidationResult;
}
```

## Examples

### Complete Example Application

See the `/example` directory for a complete NestJS application demonstrating all features:

```bash
cd example
npm install
npm run start:dev
```

The example includes:

- Public endpoints (no validation)
- Protected endpoints (various validation patterns)
- Admin endpoints (strict validation)
- Custom strategy implementations
- Database-backed validation
- Real-world usage patterns

### API Endpoints in Example

| Endpoint                  | Description         | Validation            |
| ------------------------- | ------------------- | --------------------- |
| `GET /public/info`        | Public information  | None (skipped)        |
| `GET /protected/basic`    | Basic IP validation | IP whitelist          |
| `GET /protected/api-key`  | API key only        | API key required      |
| `GET /protected/combined` | Both validations    | IP + API key          |
| `GET /admin/users`        | Admin user list     | Strict IP + admin key |
| `GET /custom/premium`     | Premium access      | Custom strategy       |
| `GET /database/users`     | Database validation | Database-backed       |

### Testing the Example

```bash
# Test public endpoint (should work)
curl http://localhost:3000/public/info

# Test protected endpoint (may fail without proper IP)
curl http://localhost:3000/protected/basic

# Test with API key
curl -H "x-api-key: demo-key-123" http://localhost:3000/protected/api-key

# Test admin endpoint (requires admin key)
curl -H "x-admin-token: admin-key-456" http://localhost:3000/admin/users
```

## Migration Guide

### From v0.x to v1.x

- Import paths updated to `@rastaweb/nest-sentinel`
- Configuration structure simplified
- New decorator syntax with better TypeScript support
- Enhanced strategy system

### Upgrading

1. Update package:

```bash
npm install @rastaweb/nest-sentinel@latest
```

2. Update imports:

```typescript
// Old
import { SentinelModule } from "nest-sentinel";

// New
import { SentinelModule } from "@rastaweb/nest-sentinel";
```

3. Update configuration:

```typescript
// Old
SentinelModule.forRoot({
  guards: { ip: true, apiKey: true },
});

// New
SentinelModule.forRoot({
  defaultIPRules: { type: "ip", allowPrivate: true },
  defaultAPIKeyRules: { type: "apiKey", required: true },
});
```

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/rastaweb/nest-sentinel.git
cd nest-sentinel
npm install
npm run build
npm test
```

### Running Tests

```bash
# Unit tests
npm test

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## License

MIT © [rastaweb](https://github.com/rastaweb)

## Support

- 📧 Email: support@rastaweb.com
- 🐛 Issues: [GitHub Issues](https://github.com/rastaweb/nest-sentinel/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/rastaweb/nest-sentinel/discussions)
- 📖 Documentation: [Full Documentation](https://nest-sentinel.rastaweb.com)

---

**Made with ❤️ by the rastaweb team**
