import { Injectable } from '@nestjs/common';
import { 
  SentinelStrategy, 
  SentinelStore, 
  ValidationContext, 
  ValidationResult,
  IPValidationRule,
  APIKeyValidationRule
} from './interfaces';
import { IPValidator, APIKeyValidator } from './utils';
import { DEFAULT_API_KEY_HEADER, ERROR_CODES } from './constants';

/**
 * Default in-memory implementation of SentinelStore
 */
@Injectable()
export class InMemorySentinelStore extends SentinelStore {
  private whitelistedIPs = new Set<string>();
  private blacklistedIPs = new Set<string>();
  private apiKeys = new Map<string, Record<string, any>>();

  async isIPAllowed(ip: string): Promise<boolean> {
    return this.whitelistedIPs.has(ip);
  }

  async isIPBlacklisted(ip: string): Promise<boolean> {
    return this.blacklistedIPs.has(ip);
  }

  async isAPIKeyValid(key: string): Promise<boolean> {
    return this.apiKeys.has(key);
  }

  async getAPIKeyMetadata(key: string): Promise<Record<string, any> | null> {
    return this.apiKeys.get(key) || null;
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
   * Add an API key with metadata
   */
  async addAPIKey(key: string, metadata: Record<string, any> = {}): Promise<void> {
    this.apiKeys.set(key, {
      createdAt: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Remove an API key
   */
  async removeAPIKey(key: string): Promise<void> {
    this.apiKeys.delete(key);
  }

  /**
   * Update API key metadata
   */
  async updateAPIKeyMetadata(key: string, metadata: Record<string, any>): Promise<void> {
    const existing = this.apiKeys.get(key);
    if (existing) {
      this.apiKeys.set(key, { ...existing, ...metadata });
    }
  }

  /**
   * List all API keys
   */
  async listAPIKeys(): Promise<Array<{ key: string; metadata: Record<string, any> }>> {
    return Array.from(this.apiKeys.entries()).map(([key, metadata]) => ({ key, metadata }));
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.whitelistedIPs.clear();
    this.blacklistedIPs.clear();
    this.apiKeys.clear();
  }
}

/**
 * Default strategy implementation
 */
@Injectable()
export class DefaultSentinelStrategy extends SentinelStrategy {
  readonly name = 'default';

  constructor(private readonly store: SentinelStore) {
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
        const apiKeyResult = await this.validateAPIKey(apiKey, routeOptions.apiKey);
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
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateIP(clientIP: string, ipConfig: any): Promise<ValidationResult> {
    // Handle simple array format
    if (Array.isArray(ipConfig)) {
      const result = IPValidator.validateIP(clientIP, { whitelist: ipConfig });
      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { validationType: 'ip', clientIP }
      };
    }

    // Handle detailed IP validation rule
    if (typeof ipConfig === 'object' && ipConfig.type === 'ip') {
      const rule = ipConfig as IPValidationRule;
      
      // Check store-based validation first
      if (await this.store.isIPBlacklisted(clientIP)) {
        return {
          allowed: false,
          reason: 'IP address is blacklisted in store',
          metadata: { validationType: 'ip', clientIP }
        };
      }

      // If there's a whitelist in store, check it
      const isInStoreWhitelist = await this.store.isIPAllowed(clientIP);
      
      const result = IPValidator.validateIP(clientIP, {
        whitelist: rule.whitelist,
        blacklist: rule.blacklist,
        allowPrivate: rule.allowPrivate,
        allowLoopback: rule.allowLoopback
      });

      // If store whitelist exists and IP validation passes, ensure it's also in store
      if (result.allowed && rule.whitelist && !isInStoreWhitelist) {
        // Allow if IP matches rule whitelist, even if not in store
        return {
          allowed: true,
          metadata: { validationType: 'ip', clientIP, source: 'rule' }
        };
      }

      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { validationType: 'ip', clientIP }
      };
    }

    return { allowed: true };
  }

  private async validateAPIKey(apiKey: string | undefined, apiKeyConfig: any): Promise<ValidationResult> {
    // Handle boolean format
    if (apiKeyConfig === true) {
      if (!apiKey) {
        return {
          allowed: false,
          reason: 'API key is required',
          metadata: { validationType: 'apiKey' }
        };
      }

      if (!APIKeyValidator.isValidFormat(apiKey)) {
        return {
          allowed: false,
          reason: 'Invalid API key format',
          metadata: { validationType: 'apiKey' }
        };
      }

      // Check if key exists in store
      const isValid = await this.store.isAPIKeyValid(apiKey);
      if (!isValid) {
        return {
          allowed: false,
          reason: 'Invalid API key',
          metadata: { validationType: 'apiKey' }
        };
      }

      // Check metadata
      const metadata = await this.store.getAPIKeyMetadata(apiKey);
      const validationResult = APIKeyValidator.validateWithMetadata(apiKey, metadata);
      
      return {
        allowed: validationResult.valid,
        reason: validationResult.reason,
        metadata: { validationType: 'apiKey', keyMetadata: metadata }
      };
    }

    // Handle detailed API key validation rule
    if (typeof apiKeyConfig === 'object' && apiKeyConfig.type === 'apiKey') {
      const rule = apiKeyConfig as APIKeyValidationRule;

      if (rule.required && !apiKey) {
        return {
          allowed: false,
          reason: 'API key is required',
          metadata: { validationType: 'apiKey' }
        };
      }

      if (apiKey) {
        if (!APIKeyValidator.isValidFormat(apiKey)) {
          return {
            allowed: false,
            reason: 'Invalid API key format',
            metadata: { validationType: 'apiKey' }
          };
        }

        if (rule.validateKey) {
          const isValid = await this.store.isAPIKeyValid(apiKey);
          if (!isValid) {
            return {
              allowed: false,
              reason: 'Invalid API key',
              metadata: { validationType: 'apiKey' }
            };
          }

          const metadata = await this.store.getAPIKeyMetadata(apiKey);
          const validationResult = APIKeyValidator.validateWithMetadata(apiKey, metadata);
          
          return {
            allowed: validationResult.valid,
            reason: validationResult.reason,
            metadata: { validationType: 'apiKey', keyMetadata: metadata }
          };
        }
      }
    }

    return { allowed: true };
  }

  private async validateRule(context: ValidationContext, rule: any): Promise<ValidationResult> {
    switch (rule.type) {
      case 'ip':
        return this.validateIP(context.clientIP, rule);
      case 'apiKey':
        return this.validateAPIKey(context.apiKey, rule);
      default:
        return {
          allowed: false,
          reason: `Unknown rule type: ${rule.type}`,
          metadata: { validationType: 'custom', ruleType: rule.type }
        };
    }
  }
}

/**
 * Strategy for allowing all requests (useful for development)
 */
@Injectable()
export class AllowAllStrategy extends SentinelStrategy {
  readonly name = 'allow-all';

  validate(): ValidationResult {
    return { 
      allowed: true, 
      metadata: { strategy: 'allow-all', warning: 'This strategy allows all requests' }
    };
  }
}

/**
 * Strategy for denying all requests (useful for maintenance mode)
 */
@Injectable()
export class DenyAllStrategy extends SentinelStrategy {
  readonly name = 'deny-all';

  validate(): ValidationResult {
    return { 
      allowed: false, 
      reason: 'Access denied by deny-all strategy',
      metadata: { strategy: 'deny-all' }
    };
  }
}

/**
 * Strategy for IP-only validation (no API key required)
 */
@Injectable()
export class IPOnlyStrategy extends SentinelStrategy {
  readonly name = 'ip-only';

  constructor(private readonly store: SentinelStore) {
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
        reason: 'IP address is blacklisted',
        metadata: { strategy: 'ip-only', clientIP }
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
      reason: isAllowed ? undefined : 'IP address not in whitelist',
      metadata: { strategy: 'ip-only', clientIP }
    };
  }

  private validateIP(clientIP: string, ipConfig: any): ValidationResult {
    if (Array.isArray(ipConfig)) {
      const result = IPValidator.validateIP(clientIP, { whitelist: ipConfig });
      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { strategy: 'ip-only', clientIP }
      };
    }

    if (typeof ipConfig === 'object' && ipConfig.type === 'ip') {
      const result = IPValidator.validateIP(clientIP, ipConfig);
      return {
        allowed: result.allowed,
        reason: result.reason,
        metadata: { strategy: 'ip-only', clientIP }
      };
    }

    return { allowed: true, metadata: { strategy: 'ip-only', clientIP } };
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