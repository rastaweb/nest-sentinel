/**
 * @rastaweb/nest-sentinel
 *
 * A comprehensive NestJS library for endpoint-level access validation
 * with IP and API key restrictions.
 *
 * @author rastaweb
 * @version 1.0.0
 */

// Core interfaces and types
export type {
  SentinelConfig,
  SentinelOptions,
  ValidationContext,
  ValidationResult,
  SentinelStore,
  SentinelAsyncOptions,
  SentinelOptionsFactory,
  IPValidationRule,
  APIKeyValidationRule,
  ValidationRule,
} from "./interfaces";

// Export the abstract SentinelStrategy class
export { SentinelStrategy } from "./interfaces";

// Export error classes
export {
  SentinelError,
  IPValidationError,
  APIKeyValidationError,
} from "./interfaces";

// Constants
export * from "./constants";

// Decorators - export everything except SentinelStrategy to avoid conflicts
export {
  Sentinel,
  SkipSentinel,
  APIKeyOnly,
  IPOnly,
  PrivateNetworkOnly,
  BlockIPs,
  RequireBoth,
  getSentinelOptions,
  getSentinelStrategy,
} from "./decorators";

// Export the SentinelStrategy decorator separately to avoid naming conflicts
export { SentinelStrategy as SentinelStrategyDecorator } from "./decorators";

// Utilities
export * from "./utils";

// Strategies
export * from "./strategies";

// Guard
export * from "./guard";

// Module
export * from "./module";

// Re-export commonly used items for convenience

export {
  InMemorySentinelStore,
  DefaultSentinelStrategy,
  AllowAllStrategy,
  DenyAllStrategy,
  IPOnlyStrategy,
  StrategyRegistry,
} from "./strategies";

export {
  IPValidator,
  APIKeyValidator,
  validateEnvironment,
  RequestUtils,
} from "./utils";

export {
  createSentinelConfig,
  createTestConfig,
  createProductionConfig,
} from "./module";
