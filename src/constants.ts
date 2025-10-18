/**
 * Constants used throughout the Sentinel library
 */

/**
 * Metadata keys for decorators
 */
export const SENTINEL_OPTIONS_METADATA = 'sentinel:options';
export const SENTINEL_STRATEGY_METADATA = 'sentinel:strategy';

/**
 * Default configuration values
 */
export const DEFAULT_API_KEY_HEADER = 'x-api-key';
export const DEFAULT_API_KEY_QUERY = 'apiKey';

/**
 * Error codes
 */
export const ERROR_CODES = {
  IP_BLOCKED: 'IP_BLOCKED',
  IP_NOT_ALLOWED: 'IP_NOT_ALLOWED',
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STRATEGY_NOT_FOUND: 'STRATEGY_NOT_FOUND',
} as const;

/**
 * Token names for dependency injection
 */
export const SENTINEL_CONFIG_TOKEN = 'SENTINEL_CONFIG';
export const SENTINEL_STORE_TOKEN = 'SENTINEL_STORE';
export const SENTINEL_STRATEGIES_TOKEN = 'SENTINEL_STRATEGIES';

/**
 * Default IP validation settings
 */
export const DEFAULT_IP_SETTINGS = {
  allowPrivate: true,
  allowLoopback: true,
} as const;