import { Injectable, Inject } from "@nestjs/common";
import {
  SentinelStrategy,
  SentinelStore,
  ValidationContext,
  ValidationResult,
  IPValidationRule,
  APIKeyValidationRule,
  SentinelConfig,
  APIKeyValidationStrategy,
  StaticAPIKeyStrategy,
  FunctionAPIKeyStrategy,
  StoreAPIKeyStrategy,
} from "./interfaces";
import { IPValidator, APIKeyValidator } from "./utils";
import {
  DEFAULT_API_KEY_HEADER,
  ERROR_CODES,
  SENTINEL_STORE_TOKEN,
  SENTINEL_CONFIG_TOKEN,
} from "./constants";

/**
 * Default in-memory implementation of SentinelStore
 * Note: This store is now focused on validation only, not key generation/management
 */
@Injectable()
export class InMemorySentinelStore extends SentinelStore {
  private whitelistedIPs = new Set<string>();
  private blacklistedIPs = new Set<string>();
  private validApiKeys = new Set<string>(); // Simplified to just track valid keys

  async isIPAllowed(ip: string): Promise<boolean> {
    return this.whitelistedIPs.has(ip);
  }

  async isIPBlacklisted(ip: string): Promise<boolean> {
    return this.blacklistedIPs.has(ip);
  }

  async isAPIKeyValid(key: string): Promise<boolean> {
    return this.validApiKeys.has(key);
  }

  async getAPIKeyMetadata(key: string): Promise<Record<string, any> | null> {
    // Simple implementation - just returns basic info if key is valid
    if (this.validApiKeys.has(key)) {
      return {
        key,
        valid: true,
        validatedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  async addIPToWhitelist(ip: string): Promise<void> {
    this.whitelistedIPs.add(ip);
  }

  async addIPToBlacklist(ip: string): Promise<void> {
    this.blacklistedIPs.add(ip);
  }

  async removeIPFromWhitelist(ip: string): Promise<void> {
    this.whitelistedIPs.delete(ip);
  }

  async removeIPFromBlacklist(ip: string): Promise<void> {
    this.blacklistedIPs.delete(ip);
  }

  /**
   * Add a pre-validated API key to the store (validation only, not generation)
   */
  async addValidAPIKey(key: string): Promise<void> {
    this.validApiKeys.add(key);
  }

  /**
   * Remove an API key from valid keys
   */
  async removeValidAPIKey(key: string): Promise<void> {
    this.validApiKeys.delete(key);
  }

  /**
   * List all valid API keys (for management purposes)
   */
  async listValidAPIKeys(): Promise<string[]> {
    return Array.from(this.validApiKeys);
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.whitelistedIPs.clear();
    this.blacklistedIPs.clear();
    this.validApiKeys.clear();
  }
}

/**
 * Default strategy implementation with enhanced API key validation
 */
@Injectable()
export class DefaultSentinelStrategy extends SentinelStrategy {
  readonly name = "default";

  constructor(
    @Inject(SENTINEL_STORE_TOKEN) private readonly store: SentinelStore,
    @Inject(SENTINEL_CONFIG_TOKEN) private readonly config: SentinelConfig
  ) {
    super();
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { clientIP, apiKey, routeOptions } = context;

    // If validation is skipped, allow access
    if (routeOptions?.skip) {
      return { allowed: true };
    }

    try {
      // Validate IP if configured
      if (routeOptions?.ip) {
        const ipResult = await this.validateIP(clientIP, routeOptions.ip);
        if (!ipResult.allowed) {
          return ipResult;
        }
      }

      // Validate API key if configured
      if (routeOptions?.apiKey) {
        const apiKeyResult = await this.validateAPIKey(
          apiKey,
          routeOptions.apiKey
        );
        if (!apiKeyResult.allowed) {
          return apiKeyResult;
        }
      }

      // Process custom rules
      if (routeOptions?.rules) {
        for (const rule of routeOptions.rules) {
          const ruleResult = await this.validateRule(context, rule);
          if (!ruleResult.allowed) {
            return ruleResult;
          }
        }
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  private async validateIP(
    clientIP: string,
    ipConfig: any
  ): Promise<ValidationResult> {
    // Handle simple array format
    if (Array.isArray(ipConfig)) {
      const result = IPValidator.validateIP(clientIP, { whitelist: ipConfig });
      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { validationType: "ip", clientIP },
      };
    }

    // Handle detailed IP validation rule
    if (typeof ipConfig === "object" && ipConfig.type === "ip") {
      const rule = ipConfig as IPValidationRule;

      // Check store-based validation first
      if (await this.store.isIPBlacklisted(clientIP)) {
        return {
          allowed: false,
          reason: "IP address is blacklisted in store",
          metadata: { validationType: "ip", clientIP },
        };
      }

      // If there's a whitelist in store, check it
      const isInStoreWhitelist = await this.store.isIPAllowed(clientIP);

      const result = IPValidator.validateIP(clientIP, {
        whitelist: rule.whitelist,
        blacklist: rule.blacklist,
        allowPrivate: rule.allowPrivate,
        allowLoopback: rule.allowLoopback,
      });

      // If store whitelist exists and IP validation passes, ensure it's also in store
      if (result.allowed && rule.whitelist && !isInStoreWhitelist) {
        // Allow if IP matches rule whitelist, even if not in store
        return {
          allowed: true,
          metadata: { validationType: "ip", clientIP, source: "rule" },
        };
      }

      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { validationType: "ip", clientIP },
      };
    }

    return { allowed: true };
  }

  private async validateAPIKey(
    apiKey: string | undefined,
    apiKeyConfig: any
  ): Promise<ValidationResult> {
    // Handle boolean format (use global configuration)
    if (apiKeyConfig === true) {
      if (!apiKey) {
        return {
          allowed: false,
          reason: "API key is required",
          metadata: { validationType: "apiKey" },
        };
      }

      // Use the new validation strategy approach
      return await this.validateAPIKeyWithStrategy(apiKey, {
        validationStrategy: this.config.apiKeyValidationStrategy || "store",
        validationFunction: this.config.globalApiKeyValidation,
        validKeys: this.config.globalValidApiKeys,
        validationOptions: this.config.globalApiKeyOptions,
      });
    }

    // Handle detailed API key validation rule
    if (typeof apiKeyConfig === "object" && apiKeyConfig.type === "apiKey") {
      const rule = apiKeyConfig as APIKeyValidationRule;

      if (rule.required && !apiKey) {
        return {
          allowed: false,
          reason: "API key is required",
          metadata: { validationType: "apiKey" },
        };
      }

      if (apiKey) {
        // Validate format if options are provided
        if (rule.validationOptions) {
          const { minLength, maxLength, pattern } = rule.validationOptions;

          if (minLength && apiKey.length < minLength) {
            return {
              allowed: false,
              reason: `API key too short (minimum ${minLength} characters)`,
              metadata: { validationType: "apiKey" },
            };
          }

          if (maxLength && apiKey.length > maxLength) {
            return {
              allowed: false,
              reason: `API key too long (maximum ${maxLength} characters)`,
              metadata: { validationType: "apiKey" },
            };
          }

          if (pattern && !pattern.test(apiKey)) {
            return {
              allowed: false,
              reason: "API key format does not match required pattern",
              metadata: { validationType: "apiKey" },
            };
          }
        } else if (!APIKeyValidator.isValidFormat(apiKey)) {
          return {
            allowed: false,
            reason: "Invalid API key format",
            metadata: { validationType: "apiKey" },
          };
        }

        // Use the validation strategy from rule or global config
        return await this.validateAPIKeyWithStrategy(apiKey, {
          validationStrategy:
            rule.validationStrategy ||
            this.config.apiKeyValidationStrategy ||
            "store",
          validationFunction:
            rule.validationFunction || this.config.globalApiKeyValidation,
          validKeys: rule.validKeys || this.config.globalValidApiKeys,
          validationOptions:
            rule.validationOptions || this.config.globalApiKeyOptions,
          validateKey: rule.validateKey, // For backwards compatibility
        });
      }
    }

    return { allowed: true };
  }

  /**
   * Validate API key using the specified strategy
   */
  private async validateAPIKeyWithStrategy(
    apiKey: string,
    options: {
      validationStrategy?: "store" | "function" | "static";
      validationFunction?: (apiKey: string) => boolean | Promise<boolean>;
      validKeys?: string[];
      validationOptions?: {
        caseSensitive?: boolean;
        allowPartialMatch?: boolean;
      };
      validateKey?: boolean; // For backwards compatibility
    }
  ): Promise<ValidationResult> {
    const {
      validationStrategy = "store",
      validationFunction,
      validKeys,
      validationOptions,
      validateKey,
    } = options;

    let strategy: APIKeyValidationStrategy;

    // Create the appropriate validation strategy
    switch (validationStrategy) {
      case "static":
        if (!validKeys || validKeys.length === 0) {
          return {
            allowed: false,
            reason: "No valid API keys configured for static validation",
            metadata: { validationType: "apiKey", strategy: "static" },
          };
        }
        strategy = new StaticAPIKeyStrategy(validKeys, validationOptions);
        break;

      case "function":
        if (!validationFunction) {
          return {
            allowed: false,
            reason:
              "No validation function provided for function-based validation",
            metadata: { validationType: "apiKey", strategy: "function" },
          };
        }
        strategy = new FunctionAPIKeyStrategy(validationFunction);
        break;

      case "store":
      default:
        // For backwards compatibility, check validateKey flag
        if (validateKey === false) {
          // Skip store validation if explicitly disabled
          return { allowed: true };
        }
        strategy = new StoreAPIKeyStrategy(this.store);
        break;
    }

    try {
      const isValid = await strategy.validate(apiKey);

      if (!isValid) {
        return {
          allowed: false,
          reason: "Invalid API key",
          metadata: { validationType: "apiKey", strategy: validationStrategy },
        };
      }

      // For store strategy, also check metadata if available
      if (validationStrategy === "store") {
        const metadata = await this.store.getAPIKeyMetadata(apiKey);
        const validationResult = APIKeyValidator.validateWithMetadata(
          apiKey,
          metadata
        );

        return {
          allowed: validationResult.valid,
          reason: validationResult.reason,
          metadata: {
            validationType: "apiKey",
            strategy: "store",
            keyMetadata: metadata,
          },
        };
      }

      return {
        allowed: true,
        metadata: { validationType: "apiKey", strategy: validationStrategy },
      };
    } catch (error) {
      return {
        allowed: false,
        reason: `API key validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          validationType: "apiKey",
          strategy: validationStrategy,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  private async validateRule(
    context: ValidationContext,
    rule: any
  ): Promise<ValidationResult> {
    switch (rule.type) {
      case "ip":
        return this.validateIP(context.clientIP, rule);
      case "apiKey":
        return this.validateAPIKey(context.apiKey, rule);
      default:
        return {
          allowed: false,
          reason: `Unknown rule type: ${rule.type}`,
          metadata: { validationType: "custom", ruleType: rule.type },
        };
    }
  }
}

/**
 * Strategy for allowing all requests (useful for development)
 */
@Injectable()
export class AllowAllStrategy extends SentinelStrategy {
  readonly name = "allow-all";

  validate(): ValidationResult {
    return {
      allowed: true,
      metadata: {
        strategy: "allow-all",
        warning: "This strategy allows all requests",
      },
    };
  }
}

/**
 * Strategy for denying all requests (useful for maintenance mode)
 */
@Injectable()
export class DenyAllStrategy extends SentinelStrategy {
  readonly name = "deny-all";

  validate(): ValidationResult {
    return {
      allowed: false,
      reason: "Access denied by deny-all strategy",
      metadata: { strategy: "deny-all" },
    };
  }
}

/**
 * Strategy for IP-only validation (no API key required)
 */
@Injectable()
export class IPOnlyStrategy extends SentinelStrategy {
  readonly name = "ip-only";

  constructor(
    @Inject(SENTINEL_STORE_TOKEN) private readonly store: SentinelStore
  ) {
    super();
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { clientIP, routeOptions } = context;

    if (routeOptions?.skip) {
      return { allowed: true };
    }

    // Check if IP is blacklisted in store
    if (await this.store.isIPBlacklisted(clientIP)) {
      return {
        allowed: false,
        reason: "IP address is blacklisted",
        metadata: { strategy: "ip-only", clientIP },
      };
    }

    // If route has IP configuration, validate against it
    if (routeOptions?.ip) {
      return this.validateIP(clientIP, routeOptions.ip);
    }

    // Default: check if IP is in store whitelist
    const isAllowed = await this.store.isIPAllowed(clientIP);
    return {
      allowed: isAllowed,
      reason: isAllowed ? undefined : "IP address not in whitelist",
      metadata: { strategy: "ip-only", clientIP },
    };
  }

  private validateIP(clientIP: string, ipConfig: any): ValidationResult {
    if (Array.isArray(ipConfig)) {
      const result = IPValidator.validateIP(clientIP, { whitelist: ipConfig });
      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { strategy: "ip-only", clientIP },
      };
    }

    if (typeof ipConfig === "object" && ipConfig.type === "ip") {
      const result = IPValidator.validateIP(clientIP, ipConfig);
      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { strategy: "ip-only", clientIP },
      };
    }

    return { allowed: true, metadata: { strategy: "ip-only", clientIP } };
  }
}

/**
 * Strategy registry for managing multiple strategies
 */
@Injectable()
export class StrategyRegistry {
  private strategies = new Map<string, SentinelStrategy>();

  register(strategy: SentinelStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  unregister(name: string): void {
    this.strategies.delete(name);
  }

  get(name: string): SentinelStrategy | undefined {
    return this.strategies.get(name);
  }

  list(): string[] {
    return Array.from(this.strategies.keys());
  }

  clear(): void {
    this.strategies.clear();
  }
}
