import { Injectable, Logger, Inject } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import type {
  OwnerType,
  ValidationResult,
  ApiKeyRecord,
  SentinelOptions,
} from "../interfaces";
import { SENTINEL_OPTIONS } from "../interfaces";

@Injectable()
export class MemoryApiKeyService {
  private readonly logger = new Logger(MemoryApiKeyService.name);
  private readonly apiKeys: Map<string, ApiKeyRecord> = new Map();

  constructor(
    @Inject(SENTINEL_OPTIONS)
    private readonly options: SentinelOptions
  ) {}

  /**
   * Create a new API key
   */
  async createKey(
    ownerType: OwnerType,
    ownerId: string,
    scopes: string[] = [],
    name?: string,
    expiresAt?: Date
  ): Promise<{ apiKey: ApiKeyRecord; rawKey: string }> {
    const rawKey = this.generateApiKey();
    const hashedKey = await this.hashKey(rawKey);
    const id = uuidv4();

    const apiKey: ApiKeyRecord = {
      id,
      name: name || `${ownerType}-${ownerId}-${Date.now()}`,
      key: hashedKey,
      ownerType,
      ownerId,
      scopes,
      isActive: true,
      createdAt: new Date(),
      expiresAt,
    };

    this.apiKeys.set(id, apiKey);

    this.logger.log(
      `Created API key for ${ownerType}:${ownerId} with scopes: [${scopes.join(", ")}]`
    );

    return {
      apiKey,
      rawKey,
    };
  }

  /**
   * Validate an API key and optional scope
   */
  async validateKey(
    key: string,
    requiredScopes?: string[]
  ): Promise<ValidationResult> {
    try {
      // Use custom validator if provided
      if (this.options.validateApiKey) {
        return await this.options.validateApiKey(key, requiredScopes);
      }

      // Check each stored key against the provided key
      for (const apiKey of this.apiKeys.values()) {
        if (apiKey.isActive && (await this.compareKey(key, apiKey.key))) {
          // Check if key is expired
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            return {
              valid: false,
              error: "API key has expired",
            };
          }

          // Check scopes if required
          if (requiredScopes && requiredScopes.length > 0) {
            const hasAllScopes = requiredScopes.every((scope) =>
              apiKey.scopes.includes(scope)
            );

            if (!hasAllScopes) {
              return {
                valid: false,
                error: `Missing required scopes: ${requiredScopes.join(", ")}`,
              };
            }
          }

          // Update last used timestamp
          apiKey.lastUsedAt = new Date();

          return {
            valid: true,
            apiKeyRecord: apiKey,
          };
        }
      }

      return {
        valid: false,
        error: "Invalid API key",
      };
    } catch (error) {
      this.logger.error("Error validating API key:", error);
      return {
        valid: false,
        error: "Validation failed",
      };
    }
  }

  /**
   * Invalidate an API key by ID
   */
  async invalidateKey(id: string): Promise<boolean> {
    try {
      const apiKey = this.apiKeys.get(id);
      if (apiKey) {
        apiKey.isActive = false;
        this.logger.log(`Invalidated API key: ${id}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error("Error invalidating API key:", error);
      return false;
    }
  }

  /**
   * Get API key by ID
   */
  async getById(id: string): Promise<ApiKeyRecord | null> {
    try {
      return this.apiKeys.get(id) || null;
    } catch (error) {
      this.logger.error("Error getting API key by ID:", error);
      return null;
    }
  }

  /**
   * List API keys for an owner
   */
  async listByOwner(
    ownerType: OwnerType,
    ownerId: string
  ): Promise<ApiKeyRecord[]> {
    try {
      const keys: ApiKeyRecord[] = [];
      for (const apiKey of this.apiKeys.values()) {
        if (apiKey.ownerType === ownerType && apiKey.ownerId === ownerId) {
          keys.push(apiKey);
        }
      }
      return keys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.logger.error("Error listing API keys:", error);
      return [];
    }
  }

  /**
   * Get all API keys (for management)
   */
  getAllKeys(): ApiKeyRecord[] {
    return Array.from(this.apiKeys.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Clear all API keys (useful for testing)
   */
  clearAll(): void {
    this.apiKeys.clear();
    this.logger.log("Cleared all API keys");
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    return `ak_${uuidv4().replace(/-/g, "")}${uuidv4().replace(/-/g, "")}`;
  }

  /**
   * Hash an API key for storage
   */
  private async hashKey(key: string): Promise<string> {
    return await bcrypt.hash(key, 12);
  }

  /**
   * Compare a raw key with a hashed key
   */
  private async compareKey(
    rawKey: string,
    hashedKey: string
  ): Promise<boolean> {
    return await bcrypt.compare(rawKey, hashedKey);
  }
}
