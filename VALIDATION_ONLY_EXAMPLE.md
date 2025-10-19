# API Key Validation-Only Example

This example demonstrates how to use `@rastaweb/nest-sentinel` in validation-only mode where developers generate their own API keys and the library only validates them.

## Overview

With the new validation-only approach, the library supports three validation strategies:

- **Static**: Validate against a predefined list of API keys
- **Function**: Use a custom validation function
- **Store**: Validate using a store (for backwards compatibility)

## Example Application

### 1. Installation

```bash
npm install @rastaweb/nest-sentinel
```

### 2. Basic Setup

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { SentinelModule } from "@rastaweb/nest-sentinel";
import { ApiController } from "./api.controller";

@Module({
  imports: [
    SentinelModule.forRoot({
      enabled: true,
      defaultStrategy: "default",
      // Global API key validation strategy
      apiKeyValidationStrategy: "static", // or 'function' or 'store'
      // For static validation - provide valid keys
      globalValidApiKeys: ["api-key-12345", "api-key-67890", "dev-key-abcdef"],
      globalApiKeyOptions: {
        caseSensitive: true,
        allowPartialMatch: false,
      },
    }),
  ],
  controllers: [ApiController],
})
export class AppModule {}
```

### 3. Controller Examples

#### Example 1: Static API Key Validation

```typescript
// api.controller.ts
import { Controller, Get, Post, Body } from "@nestjs/common";
import { Sentinel } from "@rastaweb/nest-sentinel";

@Controller("api")
export class ApiController {
  // Global static validation (uses module configuration)
  @Get("protected")
  @Sentinel({ apiKey: true })
  getProtectedData() {
    return { message: "This endpoint requires a valid API key" };
  }

  // Route-specific static validation
  @Post("upload")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "static",
      validKeys: ["upload-key-123", "admin-key-456"],
      validationOptions: {
        caseSensitive: true,
      },
    },
  })
  uploadFile(@Body() data: any) {
    return { message: "File uploaded successfully" };
  }
}
```

#### Example 2: Function-Based Validation

```typescript
// advanced.controller.ts
import { Controller, Get, Post } from "@nestjs/common";
import { Sentinel } from "@rastaweb/nest-sentinel";

@Controller("advanced")
export class AdvancedController {
  // Custom validation function
  @Get("premium")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) => {
        // Example: Validate API key format and check against database
        if (!apiKey.startsWith("premium-")) {
          return false;
        }

        // In real application, check against your database
        const validPremiumKeys = [
          "premium-abc123",
          "premium-def456",
          "premium-ghi789",
        ];

        return validPremiumKeys.includes(apiKey);
      },
    },
  })
  getPremiumContent() {
    return { message: "Premium content accessed" };
  }

  // Async validation function
  @Post("async-validation")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: async (apiKey: string) => {
        // Example: Async validation against external service
        try {
          // Simulate API call to your auth service
          const response = await fetch(
            `https://your-auth-service.com/validate/${apiKey}`
          );
          const result = await response.json();
          return result.valid === true;
        } catch (error) {
          console.error("Validation error:", error);
          return false;
        }
      },
    },
  })
  async processWithAsyncValidation() {
    return { message: "Processed with async validation" };
  }
}
```

#### Example 3: Database Integration

```typescript
// database.controller.ts
import { Controller, Get, Injectable } from "@nestjs/common";
import { Sentinel } from "@rastaweb/nest-sentinel";

// Custom validation service
@Injectable()
export class ApiKeyValidationService {
  private readonly validKeys = new Map([
    ["user-key-123", { userId: 1, permissions: ["read"] }],
    ["admin-key-456", { userId: 2, permissions: ["read", "write", "admin"] }],
    ["readonly-key-789", { userId: 3, permissions: ["read"] }],
  ]);

  async validateApiKey(apiKey: string): Promise<boolean> {
    // In real application, this would query your database
    return this.validKeys.has(apiKey);
  }

  async getKeyMetadata(apiKey: string) {
    return this.validKeys.get(apiKey);
  }
}

@Controller("database")
export class DatabaseController {
  constructor(private readonly apiKeyService: ApiKeyValidationService) {}

  @Get("users")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) =>
        this.apiKeyService.validateApiKey(apiKey),
    },
  })
  async getUsers() {
    return { users: ["user1", "user2", "user3"] };
  }
}
```

### 4. Multiple Validation Strategies in One App

```typescript
// multi-strategy.module.ts
import { Module } from "@nestjs/common";
import { SentinelModule } from "@rastaweb/nest-sentinel";

@Module({
  imports: [
    SentinelModule.forRoot({
      enabled: true,
      defaultStrategy: "default",

      // Global configuration for fallback
      apiKeyValidationStrategy: "static",
      globalValidApiKeys: ["fallback-key-123"],

      // You can also configure function validation globally
      globalApiKeyValidation: (apiKey: string) => {
        // Global validation logic
        return apiKey.length >= 10 && apiKey.includes("-");
      },
    }),
  ],
  controllers: [MultiStrategyController],
})
export class MultiStrategyModule {}

@Controller("multi")
export class MultiStrategyController {
  // Uses global static validation
  @Get("public")
  @Sentinel({ apiKey: true })
  getPublicData() {
    return { message: "Uses global static validation" };
  }

  // Override with route-specific static validation
  @Get("admin")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "static",
      validKeys: ["admin-only-key"],
    },
  })
  getAdminData() {
    return { message: "Admin-only endpoint" };
  }

  // Use function validation
  @Get("custom")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (key: string) =>
        key.startsWith("custom-") && key.length > 15,
    },
  })
  getCustomData() {
    return { message: "Custom validation endpoint" };
  }
}
```

### 5. API Key Format Validation

```typescript
// format-validation.controller.ts
import { Controller, Get } from "@nestjs/common";
import { Sentinel } from "@rastaweb/nest-sentinel";

@Controller("format")
export class FormatValidationController {
  @Get("strict-format")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationOptions: {
        minLength: 20,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9-_]+$/,
      },
      validationFunction: (apiKey: string) => {
        // Additional custom validation after format check
        const parts = apiKey.split("-");
        return parts.length === 3 && parts[0] === "api";
      },
    },
  })
  getStrictData() {
    return { message: "Strict format validation passed" };
  }
}
```

## Usage Examples

### Making Requests

```bash
# Valid request with API key in header
curl -H "X-API-Key: api-key-12345" http://localhost:3000/api/protected

# Valid request with API key in query parameter
curl "http://localhost:3000/api/protected?api_key=api-key-12345"

# Invalid API key
curl -H "X-API-Key: invalid-key" http://localhost:3000/api/protected
# Returns: 401 Unauthorized

# Missing API key
curl http://localhost:3000/api/protected
# Returns: 401 Unauthorized
```

### Response Examples

**Successful validation:**

```json
{
  "message": "This endpoint requires a valid API key"
}
```

**Failed validation:**

```json
{
  "message": "Invalid API key",
  "code": "API_KEY_INVALID",
  "metadata": {
    "clientIP": "127.0.0.1",
    "timestamp": 1697123456789
  }
}
```

## Key Benefits of Validation-Only Approach

1. **Separation of Concerns**: Your application handles API key generation and management
2. **Flexibility**: Support for multiple validation strategies in the same application
3. **Performance**: No overhead of key storage/management in the library
4. **Security**: You control where and how API keys are stored
5. **Scalability**: Easy integration with existing authentication systems

## Migration from Generation-Based Approach

If you were previously using the library for API key generation, here's how to migrate:

**Before (Generation-based):**

```typescript
// Old approach - library managed keys
@Sentinel({
  apiKey: {
    validateKey: true // Library would check its internal store
  }
})
```

**After (Validation-only):**

```typescript
// New approach - you provide validation logic
@Sentinel({
  apiKey: {
    type: 'apiKey',
    required: true,
    validationStrategy: 'function',
    validationFunction: (apiKey: string) => {
      // Your validation logic here
      return yourValidationService.isValid(apiKey);
    }
  }
})
```

## Best Practices

1. **Security**: Never hardcode API keys in your source code
2. **Environment Variables**: Use environment variables for static keys
3. **Database Integration**: For production, validate against your database
4. **Caching**: Implement caching for frequently validated keys
5. **Logging**: Log validation attempts for security monitoring
6. **Rate Limiting**: Combine with rate limiting for additional security

This validation-only approach gives you complete control over your API key lifecycle while leveraging the library's robust validation framework.
