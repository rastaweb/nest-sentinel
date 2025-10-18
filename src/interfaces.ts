import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Represents IP address validation types
 */
export type IPAddress = string;
export type IPRange = string; // CIDR notation like "192.168.0.0/24"

/**
 * Validation rule types
 */
export interface IPValidationRule {
  type: 'ip';
  whitelist?: (IPAddress | IPRange)[];
  blacklist?: (IPAddress | IPRange)[];
  allowPrivate?: boolean;
  allowLoopback?: boolean;
}

export interface APIKeyValidationRule {
  type: 'apiKey';
  header?: string; // default: 'x-api-key'
  query?: string; // query parameter name
  required?: boolean;
  validateKey?: boolean; // whether to validate key exists in store
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
 */
export abstract class SentinelStore {
  /**
   * Check if an IP address is allowed
   */
  abstract isIPAllowed(ip: string): Promise<boolean> | boolean;

  /**
   * Check if an API key is valid
   */
  abstract isAPIKeyValid(key: string): Promise<boolean> | boolean;

  /**
   * Get API key metadata (expiration, permissions, etc.)
   */
  abstract getAPIKeyMetadata(key: string): Promise<Record<string, any> | null> | Record<string, any> | null;

  /**
   * Check if an IP is blacklisted
   */
  abstract isIPBlacklisted(ip: string): Promise<boolean> | boolean;

  /**
   * Add IP to whitelist
   */
  abstract addIPToWhitelist(ip: string): Promise<void> | void;

  /**
   * Add IP to blacklist
   */
  abstract addIPToBlacklist(ip: string): Promise<void> | void;

  /**
   * Remove IP from whitelist
   */
  abstract removeIPFromWhitelist(ip: string): Promise<void> | void;

  /**
   * Remove IP from blacklist
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
  abstract validate(context: ValidationContext): Promise<ValidationResult> | ValidationResult;

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
export interface SentinelAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
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
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SentinelError';
  }
}

export class IPValidationError extends SentinelError {
  constructor(message: string, public readonly ip: string) {
    super(message, 'IP_VALIDATION_ERROR');
    this.name = 'IPValidationError';
  }
}

export class APIKeyValidationError extends SentinelError {
  constructor(message: string) {
    super(message, 'API_KEY_VALIDATION_ERROR');
    this.name = 'APIKeyValidationError';
  }
}