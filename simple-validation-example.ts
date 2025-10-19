/**
 * Simple API Key Validation Example
 *
 * This example demonstrates the three validation strategies:
 * 1. Static - predefined list of valid keys
 * 2. Function - custom validation logic
 * 3. Store - backwards compatible store-based validation
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Module,
  Injectable,
} from "@nestjs/common";
import { SentinelModule, Sentinel } from "./src/index";

// ==========================================
// Your API Key Management Service
// ==========================================

@Injectable()
export class MyApiKeyService {
  // This is your responsibility - manage your own API keys
  private validKeys = new Set([
    "dev-key-12345",
    "prod-key-67890",
    "admin-key-999",
  ]);

  private keyPermissions = new Map([
    ["dev-key-12345", ["read", "write"]],
    ["prod-key-67890", ["read", "write"]],
    ["admin-key-999", ["read", "write", "admin"]],
  ]);

  // Generate your own API keys
  generateKey(prefix: string = "api"): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${prefix}-${timestamp}-${random}`;
  }

  // Your validation logic
  isValidKey(apiKey: string): boolean {
    return this.validKeys.has(apiKey);
  }

  // Check permissions
  hasPermission(apiKey: string, permission: string): boolean {
    const permissions = this.keyPermissions.get(apiKey);
    return permissions?.includes(permission) || false;
  }

  // Add a new key (your responsibility)
  addKey(apiKey: string, permissions: string[] = ["read"]) {
    this.validKeys.add(apiKey);
    this.keyPermissions.set(apiKey, permissions);
  }
}

// ==========================================
// Controllers demonstrating validation strategies
// ==========================================

@Controller("examples")
export class ValidationExamplesController {
  constructor(private readonly apiKeyService: MyApiKeyService) {}

  // Strategy 1: Static validation - hardcoded list of valid keys
  @Get("static-validation")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "static",
      validKeys: ["dev-key-12345", "prod-key-67890"], // Your predefined keys
    },
  })
  staticValidationExample() {
    return {
      message: "Success! Used static validation",
      strategy: "static",
      validKeys: ["dev-key-12345", "prod-key-67890"],
    };
  }

  // Strategy 2: Function validation - your custom logic
  @Get("function-validation")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) => {
        // Your custom validation logic
        return this.apiKeyService.isValidKey(apiKey);
      },
    },
  })
  functionValidationExample() {
    return {
      message: "Success! Used function validation",
      strategy: "function",
      note: "Validated using custom function",
    };
  }

  // Strategy 3: Admin-only endpoint with permission check
  @Post("admin-only")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) => {
        // Combine validation with permission check
        return (
          this.apiKeyService.isValidKey(apiKey) &&
          this.apiKeyService.hasPermission(apiKey, "admin")
        );
      },
    },
  })
  adminOnlyExample(@Body() data: any) {
    return {
      message: "Admin operation successful!",
      strategy: "function with permission check",
      data: data,
    };
  }

  // Strategy 4: Async validation (external service, database, etc.)
  @Get("async-validation")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: async (apiKey: string) => {
        // Simulate async validation (database call, external API, etc.)
        await new Promise((resolve) => setTimeout(resolve, 100));
        return this.apiKeyService.isValidKey(apiKey);
      },
    },
  })
  asyncValidationExample() {
    return {
      message: "Success! Used async validation",
      strategy: "async function",
      note: "Can call databases or external services",
    };
  }
}

// ==========================================
// API Key Management Controller
// ==========================================

@Controller("key-management")
export class KeyManagementController {
  constructor(private readonly apiKeyService: MyApiKeyService) {}

  // Generate new API keys (your responsibility)
  @Post("generate")
  generateApiKey(@Body() request: { prefix?: string; permissions?: string[] }) {
    const { prefix = "custom", permissions = ["read"] } = request;

    const newKey = this.apiKeyService.generateKey(prefix);
    this.apiKeyService.addKey(newKey, permissions);

    return {
      message: "API key generated successfully",
      apiKey: newKey,
      permissions: permissions,
      note: "Store this key securely - you won't see it again!",
    };
  }

  // Test endpoint to verify your generated key works
  @Get("test")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) =>
        this.apiKeyService.isValidKey(apiKey),
    },
  })
  testApiKey() {
    return {
      message: "Your API key is valid!",
      timestamp: new Date().toISOString(),
    };
  }
}

// ==========================================
// Module configuration
// ==========================================

@Module({
  imports: [
    SentinelModule.forRoot({
      enabled: true,
      defaultStrategy: "default",

      // Global fallback configuration
      apiKeyValidationStrategy: "static",
      globalValidApiKeys: ["dev-key-12345"], // Fallback keys

      // Optional: Global validation function
      globalApiKeyValidation: (apiKey: string) => {
        // Global validation logic as fallback
        return apiKey.length > 10 && apiKey.includes("-");
      },
    }),
  ],
  controllers: [ValidationExamplesController, KeyManagementController],
  providers: [MyApiKeyService],
})
export class ApiKeyValidationExampleModule {}

// ==========================================
// Usage Instructions
// ==========================================

/*

USAGE EXAMPLES:

1. Test with existing keys:
   curl -H "X-API-Key: dev-key-12345" http://localhost:3000/examples/static-validation
   curl -H "X-API-Key: admin-key-999" http://localhost:3000/examples/admin-only

2. Generate a new key:
   curl -X POST -H "Content-Type: application/json" \
        -d '{"prefix":"myapp","permissions":["read","write"]}' \
        http://localhost:3000/key-management/generate

3. Test your generated key:
   curl -H "X-API-Key: YOUR_GENERATED_KEY" http://localhost:3000/key-management/test

4. Try invalid key:
   curl -H "X-API-Key: invalid-key" http://localhost:3000/examples/static-validation
   # Returns 401 Unauthorized

KEY BENEFITS:

✅ You control API key generation and storage
✅ Library only handles validation
✅ Multiple validation strategies in one app
✅ Easy integration with existing auth systems
✅ No library dependencies for key management

VALIDATION STRATEGIES:

1. Static: Simple list of valid keys
   - Best for: Small number of keys, development, specific access tokens
   
2. Function: Custom validation logic
   - Best for: Database lookups, permission checks, complex validation
   
3. Store: Backwards compatibility
   - Best for: Migration from old versions

*/

export { ApiKeyValidationExampleModule, MyApiKeyService };
