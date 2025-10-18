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
export * from './interfaces';

// Constants
export * from './constants';

// Decorators
export * from './decorators';

// Utilities
export * from './utils';

// Strategies
export * from './strategies';

// Guard
export * from './guard';

// Module
export * from './module';

// Re-export commonly used items for convenience
export {
  Sentinel,
  SkipSentinel,
  SentinelStrategy,
  APIKeyOnly,
  IPOnly,
  PrivateNetworkOnly,
  BlockIPs,
  RequireBoth
} from './decorators';

export {
  InMemorySentinelStore,
  DefaultSentinelStrategy,
  AllowAllStrategy,
  DenyAllStrategy,
  IPOnlyStrategy,
  StrategyRegistry
} from './strategies';

export {
  IPValidator,
  APIKeyValidator,
  validateEnvironment,
  RequestUtils
} from './utils';

export {
  createSentinelConfig,
  createTestConfig,
  createProductionConfig
} from './module';