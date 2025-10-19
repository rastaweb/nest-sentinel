import { ModuleMetadata, Type } from "@nestjs/common";

/**
 * Represents IP address validation types
 */
export type IPAddress = string;
export type IPRange = string; // CIDR notation like "192.168.0.0/24"

/**
 * Validation rule types
 */
export interface IPValidationRule {
  type: "ip";
  whitelist?: (IPAddress | IPRange)[];
  blacklist?: (IPAddress | IPRange)[];
  allowPrivate?: boolean;
  allowLoopback?: boolean;
}

export interface APIKeyValidationRule {
  type: "apiKey";
  header?: string; // default: 'x-api-key'
  query?: string; // query parameter name
  required?: boolean;
  validateKey?: boolean; // whether to validate key exists in store
  /** Strategy for validating API keys - 'store' | 'function' | 'static' */
  validationStrategy?: "store" | "function" | "static";
  /** For 'function' strategy: custom validation function */
  validationFunction?: (apiKey: string) => boolean | Promise<boolean>;
  /** For 'static' strategy: array of valid API keys */
  validKeys?: string[];
  /** Additional validation options */
  validationOptions?: {
    caseSensitive?: boolean;
    allowPartialMatch?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  };
}

export type ValidationRule = IPValidationRule | APIKeyValidationRule;

/**
 * Configuration for route-level sentinel decorator
 */
export interface SentinelOptions {
  /** IP addresses or ranges to allow/deny */
  ip?: (IPAddress | IPRange)[] | IPValidationRule;
  /** API key validation configuration */
  apiKey?: boolean | APIKeyValidationRule;
  /** Whether to skip validation entirely for this route */
  skip?: boolean;
  /** Custom validation rules */
  rules?: ValidationRule[];
  /** Strategy name to use for this route */
  strategy?: string;
}

/**
 * Global sentinel configuration
 */
export interface SentinelConfig {
  /** Default IP validation rules */
  defaultIPRules?: IPValidationRule;
  /** Default API key validation rules */
  defaultAPIKeyRules?: APIKeyValidationRule;
  /** Global validation rules applied to all routes */
  globalRules?: ValidationRule[];
  /** Whether validation is enabled globally */
  enabled?: boolean;
  /** Default strategy to use */
  defaultStrategy?: string;
  /** Environment validation schema */
  envValidation?: boolean;
  /** Global API key validation strategy */
  apiKeyValidationStrategy?: "store" | "function" | "static";
  /** Global API key validation function (when strategy is 'function') */
  globalApiKeyValidation?: (apiKey: string) => boolean | Promise<boolean>;
  /** Global valid API keys (when strategy is 'static') */
  globalValidApiKeys?: string[];
  /** Global API key validation options */
  globalApiKeyOptions?: {
    caseSensitive?: boolean;
    allowPartialMatch?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  };
}

/**
 * Context passed to validation strategies
 */
export interface ValidationContext {
  /** Client IP address */
  clientIP: string;
  /** API key from request */
  apiKey?: string;
  /** Request headers */
  headers: Record<string, string | string[]>;
  /** Query parameters */
  query: Record<string, any>;
  /** Route-specific options */
  routeOptions?: SentinelOptions;
  /** User agent */
  userAgent?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of validation attempt
 */
export interface ValidationResult {
  /** Whether validation passed */
  allowed: boolean;
  /** Reason for denial (if not allowed) */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Abstract store interface for persistent data
 * Note: This store is now focused on validation only, not key generation/management
 */
export abstract class SentinelStore {
  /**
   * Check if an IP address is allowed
   */
  abstract isIPAllowed(ip: string): Promise<boolean> | boolean;

  /**
   * Check if an API key is valid (for 'store' validation strategy)
   */
  abstract isAPIKeyValid(key: string): Promise<boolean> | boolean;

  /**
   * Get API key metadata (expiration, permissions, etc.) - optional for validation
   */
  abstract getAPIKeyMetadata(
    key: string
  ): Promise<Record<string, any> | null> | Record<string, any> | null;

  /**
   * Check if an IP is blacklisted
   */
  abstract isIPBlacklisted(ip: string): Promise<boolean> | boolean;

  /**
   * Add IP to whitelist (for IP management)
   */
  abstract addIPToWhitelist(ip: string): Promise<void> | void;

  /**
   * Add IP to blacklist (for IP management)
   */
  abstract addIPToBlacklist(ip: string): Promise<void> | void;

  /**
   * Remove IP from whitelist (for IP management)
   */
  abstract removeIPFromWhitelist(ip: string): Promise<void> | void;

  /**
   * Remove IP from blacklist (for IP management)
   */
  abstract removeIPFromBlacklist(ip: string): Promise<void> | void;
}

/**
 * Abstract strategy interface for extensible validation logic
 */
export abstract class SentinelStrategy {
  /**
   * Strategy name
   */
  abstract readonly name: string;

  /**
   * Validate access based on context
   */
  abstract validate(
    context: ValidationContext
  ): Promise<ValidationResult> | ValidationResult;

  /**
   * Optional setup hook called when strategy is registered
   */
  setup?(): Promise<void> | void;

  /**
   * Optional cleanup hook called when strategy is destroyed
   */
  cleanup?(): Promise<void> | void;
}

/**
 * Factory for creating sentinel strategies
 */
export interface SentinelStrategyFactory {
  createStrategy(): SentinelStrategy;
}

/**
 * Async options for module configuration
 */
export interface SentinelAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  useExisting?: Type<SentinelOptionsFactory>;
  useClass?: Type<SentinelOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<SentinelConfig> | SentinelConfig;
  inject?: any[];
}

/**
 * Options factory interface
 */
export interface SentinelOptionsFactory {
  createSentinelOptions(): Promise<SentinelConfig> | SentinelConfig;
}

/**
 * Error types
 */
export class SentinelError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SentinelError";
  }
}

export class IPValidationError extends SentinelError {
  constructor(
    message: string,
    public readonly ip: string
  ) {
    super(message, "IP_VALIDATION_ERROR");
    this.name = "IPValidationError";
  }
}

export class APIKeyValidationError extends SentinelError {
  constructor(message: string) {
    super(message, "API_KEY_VALIDATION_ERROR");
    this.name = "APIKeyValidationError";
  }
}

export class JWTValidationError extends SentinelError {
  constructor(
    message: string,
    public readonly token?: string
  ) {
    super(message, "JWT_VALIDATION_ERROR");
    this.name = "JWTValidationError";
  }
}

/**
 * API Key validation strategies
 */
export interface APIKeyValidationStrategy {
  name: string;
  validate(apiKey: string, options?: any): Promise<boolean> | boolean;
}

/**
 * Built-in static API key validation strategy
 */
export class StaticAPIKeyStrategy implements APIKeyValidationStrategy {
  readonly name = "static";

  constructor(
    private validKeys: string[],
    private options?: {
      caseSensitive?: boolean;
      allowPartialMatch?: boolean;
    }
  ) {}

  validate(apiKey: string): boolean {
    const { caseSensitive = true, allowPartialMatch = false } =
      this.options || {};

    if (allowPartialMatch) {
      return this.validKeys.some((validKey) => {
        const key1 = caseSensitive ? apiKey : apiKey.toLowerCase();
        const key2 = caseSensitive ? validKey : validKey.toLowerCase();
        return key1.includes(key2) || key2.includes(key1);
      });
    }

    return this.validKeys.some((validKey) => {
      const key1 = caseSensitive ? apiKey : apiKey.toLowerCase();
      const key2 = caseSensitive ? validKey : validKey.toLowerCase();
      return key1 === key2;
    });
  }
}

/**
 * Function-based API key validation strategy
 */
export class FunctionAPIKeyStrategy implements APIKeyValidationStrategy {
  readonly name = "function";

  constructor(
    private validationFunction: (apiKey: string) => boolean | Promise<boolean>
  ) {}

  async validate(apiKey: string): Promise<boolean> {
    const result = this.validationFunction(apiKey);
    return result instanceof Promise ? await result : result;
  }
}

/**
 * Store-based API key validation strategy (legacy/existing behavior)
 */
export class StoreAPIKeyStrategy implements APIKeyValidationStrategy {
  readonly name = "store";

  constructor(private store: SentinelStore) {}

  async validate(apiKey: string): Promise<boolean> {
    return await this.store.isAPIKeyValid(apiKey);
  }
}
