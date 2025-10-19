# API Key Validation-Only Guide

## Overview

The refactored `@rastaweb/nest-sentinel` library now focuses on **validation-only** for API keys. This means:

- ✅ **You generate and manage your own API keys**
- ✅ **The library only validates them using your logic**
- ✅ **Three validation strategies available**
- ✅ **No dependency on library's storage system**

## Quick Start

### 1. Installation

```bash
npm install @rastaweb/nest-sentinel
```

### 2. Basic Module Setup

```typescript
import { Module } from "@nestjs/common";
import { SentinelModule } from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    SentinelModule.forRoot({
      enabled: true,
      defaultStrategy: "default",
      // Global validation strategy
      apiKeyValidationStrategy: "static", // or 'function' or 'store'
      globalValidApiKeys: ["your-api-key-1", "your-api-key-2"],
    }),
  ],
})
export class AppModule {}
```

## Validation Strategies

### Strategy 1: Static Validation

Use a predefined list of valid API keys.

```typescript
import { Controller, Get } from "@nestjs/common";
import { Sentinel } from "@rastaweb/nest-sentinel";

@Controller("api")
export class ApiController {
  @Get("data")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "static",
      validKeys: ["dev-key-12345", "prod-key-67890", "admin-key-999"],
    },
  })
  getData() {
    return { message: "Access granted with static validation" };
  }
}
```

**Best for:** Development, small number of keys, simple access tokens

### Strategy 2: Function Validation

Use custom validation logic (database, external service, etc.).

```typescript
@Injectable()
export class ApiKeyService {
  // Your own API key management
  private validKeys = new Set(["key1", "key2", "key3"]);

  validateApiKey(apiKey: string): boolean {
    return this.validKeys.has(apiKey);
  }

  async validateApiKeyAsync(apiKey: string): Promise<boolean> {
    // Call your database, external API, etc.
    return await yourDatabase.checkApiKey(apiKey);
  }
}

@Controller("api")
export class ApiController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Get("secure")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) => {
        return this.apiKeyService.validateApiKey(apiKey);
      },
    },
  })
  getSecureData() {
    return { message: "Access granted with function validation" };
  }

  @Get("async-secure")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: async (apiKey: string) => {
        return await this.apiKeyService.validateApiKeyAsync(apiKey);
      },
    },
  })
  async getAsyncSecureData() {
    return { message: "Access granted with async validation" };
  }
}
```

**Best for:** Database lookups, external API validation, complex business logic

### Strategy 3: Store Validation (Backwards Compatibility)

For migration from previous versions.

```typescript
@Get('legacy')
@Sentinel({
  apiKey: {
    type: 'apiKey',
    required: true,
    validationStrategy: 'store'
    // Uses configured store for validation
  }
})
getLegacyData() {
  return { message: 'Access granted with store validation' };
}
```

## Real-World Examples

### Example 1: E-commerce API

```typescript
@Injectable()
export class EcommerceApiKeyService {
  constructor(private database: DatabaseService) {}

  async validateApiKey(apiKey: string): Promise<boolean> {
    const key = await this.database.findApiKey(apiKey);
    return key && key.active && !key.expired;
  }

  async getKeyPermissions(apiKey: string): Promise<string[]> {
    const key = await this.database.findApiKey(apiKey);
    return key?.permissions || [];
  }
}

@Controller("ecommerce")
export class EcommerceController {
  constructor(private apiKeyService: EcommerceApiKeyService) {}

  // Public product listing - basic validation
  @Get("products")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (key) => this.apiKeyService.validateApiKey(key),
    },
  })
  async getProducts() {
    return await this.productService.getAllProducts();
  }

  // Admin operations - permission check
  @Post("products")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: async (key) => {
        const isValid = await this.apiKeyService.validateApiKey(key);
        const permissions = await this.apiKeyService.getKeyPermissions(key);
        return isValid && permissions.includes("admin");
      },
    },
  })
  async createProduct(@Body() product: any) {
    return await this.productService.createProduct(product);
  }
}
```

### Example 2: Multi-Tenant SaaS

```typescript
@Injectable()
export class TenantApiKeyService {
  constructor(private tenantService: TenantService) {}

  async validateTenantApiKey(apiKey: string): Promise<boolean> {
    const tenant = await this.tenantService.findByApiKey(apiKey);
    return tenant && tenant.subscription.active;
  }

  async getTenantId(apiKey: string): Promise<string | null> {
    const tenant = await this.tenantService.findByApiKey(apiKey);
    return tenant?.id || null;
  }
}

@Controller("tenant")
export class TenantController {
  constructor(private tenantService: TenantApiKeyService) {}

  @Get("data/:tenantId")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: async (key) => {
        // Validate key and ensure it belongs to the requested tenant
        const isValid = await this.tenantService.validateTenantApiKey(key);
        const keyTenantId = await this.tenantService.getTenantId(key);
        const requestedTenantId = this.request.params.tenantId;
        return isValid && keyTenantId === requestedTenantId;
      },
    },
  })
  async getTenantData(@Param("tenantId") tenantId: string) {
    return await this.dataService.getTenantData(tenantId);
  }
}
```

## API Key Generation (Your Responsibility)

The library doesn't generate keys - you do! Here are some examples:

### Simple Generation

```typescript
@Injectable()
export class ApiKeyGenerator {
  generateApiKey(prefix: string = "api"): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2);
    return `${prefix}-${timestamp}-${randomPart}`;
  }

  generateSecureApiKey(): string {
    // Use crypto for better randomness
    const crypto = require("crypto");
    const randomBytes = crypto.randomBytes(32);
    return `sk-${randomBytes.toString("hex")}`;
  }
}

@Controller("admin")
export class AdminController {
  constructor(private keyGenerator: ApiKeyGenerator) {}

  @Post("generate-key")
  generateApiKey(@Body() request: { userId: string; permissions: string[] }) {
    const apiKey = this.keyGenerator.generateSecureApiKey();

    // Store in your database
    await this.database.saveApiKey({
      key: apiKey,
      userId: request.userId,
      permissions: request.permissions,
      createdAt: new Date(),
      active: true,
    });

    return {
      apiKey,
      message: "API key generated successfully",
      note: "Store this securely - you won't see it again!",
    };
  }
}
```

## Testing Your Implementation

### curl Examples

```bash
# Valid API key
curl -H "X-API-Key: your-valid-key" http://localhost:3000/api/data

# API key in query parameter
curl "http://localhost:3000/api/data?api_key=your-valid-key"

# Invalid API key (should return 401)
curl -H "X-API-Key: invalid-key" http://localhost:3000/api/data

# Missing API key (should return 401)
curl http://localhost:3000/api/data
```

### HTTP Client Testing

```typescript
// test-api-keys.spec.ts
describe("API Key Validation", () => {
  it("should accept valid API key", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/data")
      .set("X-API-Key", "valid-key-123")
      .expect(200);

    expect(response.body.message).toBeDefined();
  });

  it("should reject invalid API key", async () => {
    await request(app.getHttpServer())
      .get("/api/data")
      .set("X-API-Key", "invalid-key")
      .expect(401);
  });

  it("should reject missing API key", async () => {
    await request(app.getHttpServer()).get("/api/data").expect(401);
  });
});
```

## Migration from Previous Versions

If you were using the library for API key generation:

### Before (Generation-based)

```typescript
// Old - library managed keys
@Sentinel({
  apiKey: { validateKey: true }
})
```

### After (Validation-only)

```typescript
// New - you provide validation
@Sentinel({
  apiKey: {
    type: 'apiKey',
    required: true,
    validationStrategy: 'function',
    validationFunction: (apiKey) => yourValidationService.isValid(apiKey)
  }
})
```

## Benefits

1. **🔒 Security**: You control where and how API keys are stored
2. **🚀 Performance**: No overhead from key management in the library
3. **🔧 Flexibility**: Use any database, cache, or external service
4. **📈 Scalability**: Integrate with existing authentication systems
5. **🎯 Focus**: Library focuses only on validation logic

## Best Practices

1. **Never hardcode API keys** in your source code
2. **Use environment variables** for development keys
3. **Implement key rotation** in your key management system
4. **Log validation attempts** for security monitoring
5. **Use HTTPS** for all API communications
6. **Implement rate limiting** alongside API key validation
7. **Store keys securely** (encrypted, hashed, etc.)

## Common Patterns

### Environment-based Configuration

```typescript
// config.service.ts
@Injectable()
export class ConfigService {
  getValidApiKeys(): string[] {
    return process.env.VALID_API_KEYS?.split(",") || [];
  }

  getApiKeyValidationUrl(): string {
    return process.env.API_KEY_VALIDATION_URL || "";
  }
}

// Use in validation
validationFunction: async (apiKey) => {
  const validKeys = this.configService.getValidApiKeys();
  return validKeys.includes(apiKey);
};
```

### Cache-based Validation

```typescript
@Injectable()
export class CachedApiKeyService {
  constructor(private cacheService: CacheService) {}

  async validateApiKey(apiKey: string): Promise<boolean> {
    // Check cache first
    const cached = await this.cacheService.get(`api-key:${apiKey}`);
    if (cached !== null) {
      return cached === "valid";
    }

    // Validate and cache result
    const isValid = await this.performValidation(apiKey);
    await this.cacheService.set(
      `api-key:${apiKey}`,
      isValid ? "valid" : "invalid",
      300
    );

    return isValid;
  }
}
```

This validation-only approach gives you complete control over your API key lifecycle while leveraging the library's robust validation framework!
