import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Injectable,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SentinelModule, Sentinel } from "./src/index";

/**
 * Example: API Key Validation-Only Implementation
 *
 * This example shows how to use the refactored @rastaweb/nest-sentinel library
 * where developers generate their own API keys and the library only validates them.
 */

// ==========================================
// 1. Custom API Key Management Service
// ==========================================

@Injectable()
export class ApiKeyManagementService {
  // In a real application, this would be your database
  private readonly apiKeys = new Map([
    [
      "dev-key-12345",
      {
        userId: "user1",
        name: "Development Key",
        permissions: ["read", "write"],
        createdAt: new Date("2024-01-01"),
        active: true,
      },
    ],
    [
      "prod-key-67890",
      {
        userId: "user2",
        name: "Production Key",
        permissions: ["read", "write", "admin"],
        createdAt: new Date("2024-01-15"),
        active: true,
      },
    ],
    [
      "readonly-key-abc",
      {
        userId: "user3",
        name: "Read-Only Key",
        permissions: ["read"],
        createdAt: new Date("2024-02-01"),
        active: true,
      },
    ],
    [
      "expired-key-old",
      {
        userId: "user4",
        name: "Expired Key",
        permissions: ["read"],
        createdAt: new Date("2023-01-01"),
        active: false,
      },
    ],
  ]);

  /**
   * Generate a new API key (your responsibility, not the library's)
   */
  generateApiKey(userId: string, name: string, permissions: string[]): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const apiKey = `${userId}-${timestamp}-${random}`;

    this.apiKeys.set(apiKey, {
      userId,
      name,
      permissions,
      createdAt: new Date(),
      active: true,
    });

    return apiKey;
  }

  /**
   * Validate API key format and existence
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.length < 10) {
      return false;
    }

    const keyData = this.apiKeys.get(apiKey);
    return keyData !== undefined && keyData.active;
  }

  /**
   * Get API key metadata
   */
  getApiKeyMetadata(apiKey: string) {
    return this.apiKeys.get(apiKey);
  }

  /**
   * Check if API key has specific permission
   */
  hasPermission(apiKey: string, permission: string): boolean {
    const keyData = this.apiKeys.get(apiKey);
    return keyData?.permissions.includes(permission) || false;
  }

  /**
   * List all active API keys for a user (for management purposes)
   */
  getUserApiKeys(userId: string) {
    const userKeys: any[] = [];
    for (const [key, data] of this.apiKeys.entries()) {
      if (data.userId === userId && data.active) {
        userKeys.push({
          key: key.substring(0, 8) + "..." + key.substring(key.length - 4), // Masked
          name: data.name,
          permissions: data.permissions,
          createdAt: data.createdAt,
        });
      }
    }
    return userKeys;
  }
}

// ==========================================
// 2. API Controllers with Different Validation Strategies
// ==========================================

@Controller("api/static")
export class StaticValidationController {
  /**
   * Example 1: Static API Key Validation
   * Use a predefined list of valid API keys
   */

  @Get("public")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "static",
      validKeys: ["dev-key-12345", "prod-key-67890", "readonly-key-abc"],
      validationOptions: {
        caseSensitive: true,
      },
    },
  })
  getPublicData() {
    return {
      message: "This endpoint uses static API key validation",
      data: { timestamp: new Date().toISOString() },
    };
  }

  @Post("admin")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "static",
      validKeys: ["prod-key-67890"], // Only production key has admin access
    },
  })
  adminOperation(@Body() data: any) {
    return {
      message: "Admin operation completed",
      operation: "admin-action",
      data,
    };
  }
}

@Controller("api/function")
export class FunctionValidationController {
  constructor(private readonly apiKeyService: ApiKeyManagementService) {}

  /**
   * Example 2: Function-Based API Key Validation
   * Use custom validation logic
   */

  @Get("data")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) =>
        this.apiKeyService.validateApiKey(apiKey),
    },
  })
  async getData() {
    return {
      message: "This endpoint uses function-based validation",
      data: ["item1", "item2", "item3"],
    };
  }

  @Get("premium")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) => {
        // Custom validation: check if key has admin permissions
        return this.apiKeyService.hasPermission(apiKey, "admin");
      },
    },
  })
  getPremiumData() {
    return {
      message: "Premium content - requires admin permission",
      data: { premium: true, exclusive: "content" },
    };
  }

  @Post("upload")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationOptions: {
        minLength: 10,
        maxLength: 100,
      },
      validationFunction: async (apiKey: string) => {
        // Async validation with multiple checks
        const isValid = await this.apiKeyService.validateApiKey(apiKey);
        const hasWritePermission = this.apiKeyService.hasPermission(
          apiKey,
          "write"
        );
        return isValid && hasWritePermission;
      },
    },
  })
  async uploadFile(@Body() fileData: any) {
    return {
      message: "File uploaded successfully",
      fileId: Math.random().toString(36).substring(2),
      uploadedAt: new Date().toISOString(),
    };
  }
}

@Controller("api/management")
export class ApiKeyManagementController {
  constructor(private readonly apiKeyService: ApiKeyManagementService) {}

  /**
   * Example 3: API Key Management Endpoints
   * These endpoints help developers manage their own API keys
   */

  @Post("generate")
  generateApiKey(
    @Body() request: { userId: string; name: string; permissions: string[] }
  ) {
    const { userId, name, permissions } = request;

    // Validate permissions
    const validPermissions = ["read", "write", "admin"];
    const invalidPermissions = permissions.filter(
      (p) => !validPermissions.includes(p)
    );

    if (invalidPermissions.length > 0) {
      return {
        error: "Invalid permissions",
        invalidPermissions,
        validPermissions,
      };
    }

    const apiKey = this.apiKeyService.generateApiKey(userId, name, permissions);

    return {
      message: "API key generated successfully",
      apiKey, // In production, consider returning this securely
      metadata: {
        userId,
        name,
        permissions,
        createdAt: new Date().toISOString(),
      },
    };
  }

  @Get("list/:userId")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (apiKey: string) =>
        this.apiKeyService.validateApiKey(apiKey),
    },
  })
  listUserApiKeys(@Body("userId") userId: string) {
    const keys = this.apiKeyService.getUserApiKeys(userId);
    return {
      message: "User API keys retrieved",
      userId,
      keys,
    };
  }
}

// ==========================================
// 3. Mixed Strategy Example
// ==========================================

@Controller("api/mixed")
export class MixedStrategyController {
  constructor(private readonly apiKeyService: ApiKeyManagementService) {}

  /**
   * Example 4: Different strategies for different endpoints in same controller
   */

  // Global static validation
  @Get("public")
  @Sentinel({ apiKey: true }) // Uses global configuration
  getPublicEndpoint() {
    return { message: "Uses global validation strategy" };
  }

  // Route-specific static validation
  @Get("static")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "static",
      validKeys: ["dev-key-12345"],
    },
  })
  getStaticEndpoint() {
    return { message: "Uses route-specific static validation" };
  }

  // Function validation
  @Get("function")
  @Sentinel({
    apiKey: {
      type: "apiKey",
      required: true,
      validationStrategy: "function",
      validationFunction: (key: string) =>
        this.apiKeyService.validateApiKey(key),
    },
  })
  getFunctionEndpoint() {
    return { message: "Uses function validation" };
  }
}

// ==========================================
// 4. Module Configuration
// ==========================================

@Module({
  imports: [
    SentinelModule.forRoot({
      enabled: true,
      defaultStrategy: "default",

      // Global API key validation strategy (fallback)
      apiKeyValidationStrategy: "static",
      globalValidApiKeys: ["dev-key-12345", "prod-key-67890"],
      globalApiKeyOptions: {
        caseSensitive: true,
        allowPartialMatch: false,
      },
    }),
  ],
  controllers: [
    StaticValidationController,
    FunctionValidationController,
    ApiKeyManagementController,
    MixedStrategyController,
  ],
  providers: [ApiKeyManagementService],
})
export class ValidationOnlyExampleModule {}

// ==========================================
// 5. Test Application
// ==========================================

async function bootstrap() {
  const app = await NestFactory.create(ValidationOnlyExampleModule);

  // Add global prefix
  app.setGlobalPrefix("validation-example");

  console.log("\n🔐 API Key Validation-Only Example");
  console.log("=====================================");
  console.log("\nAvailable API Keys for testing:");
  console.log("• dev-key-12345 (Development - read, write)");
  console.log("• prod-key-67890 (Production - read, write, admin)");
  console.log("• readonly-key-abc (Read-only - read)");
  console.log("• expired-key-old (Expired - inactive)");

  console.log("\nExample endpoints:");
  console.log("• GET /validation-example/api/static/public");
  console.log("• POST /validation-example/api/static/admin");
  console.log("• GET /validation-example/api/function/data");
  console.log("• GET /validation-example/api/function/premium");
  console.log("• POST /validation-example/api/function/upload");
  console.log("• POST /validation-example/api/management/generate");
  console.log("• GET /validation-example/api/management/list/:userId");

  console.log("\nUsage examples:");
  console.log(
    'curl -H "X-API-Key: dev-key-12345" http://localhost:3000/validation-example/api/static/public'
  );
  console.log(
    'curl -H "X-API-Key: prod-key-67890" http://localhost:3000/validation-example/api/function/premium'
  );

  await app.listen(3000);
  console.log("\n🚀 Application is running on: http://localhost:3000");
}

// Uncomment to run this example
// bootstrap();

export {
  ValidationOnlyExampleModule,
  ApiKeyManagementService,
  StaticValidationController,
  FunctionValidationController,
  ApiKeyManagementController,
  MixedStrategyController,
};
