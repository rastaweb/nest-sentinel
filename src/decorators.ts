import { SetMetadata } from '@nestjs/common';
import { SENTINEL_OPTIONS_METADATA, SENTINEL_STRATEGY_METADATA } from './constants';
import { SentinelOptions } from './interfaces';

/**
 * Decorator to configure sentinel validation for a route or controller
 * 
 * @example
 * ```typescript
 * @Sentinel({
 *   ip: ['192.168.0.1/24'],
 *   apiKey: true
 * })
 * @Get('/protected')
 * async getProtectedData() {
 *   return { message: 'This is protected data' };
 * }
 * ```
 * 
 * @example
 * ```typescript
 * @Sentinel({
 *   ip: {
 *     type: 'ip',
 *     whitelist: ['10.0.0.0/8'],
 *     blacklist: ['10.0.0.100'],
 *     allowPrivate: true
 *   },
 *   apiKey: {
 *     type: 'apiKey',
 *     header: 'x-custom-key',
 *     required: true
 *   }
 * })
 * @Post('/admin')
 * async adminAction() {
 *   return { message: 'Admin action completed' };
 * }
 * ```
 */
export const Sentinel = (options: SentinelOptions = {}): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_OPTIONS_METADATA, options);
};

/**
 * Decorator to skip sentinel validation for a specific route
 * 
 * @example
 * ```typescript
 * @SkipSentinel()
 * @Get('/public')
 * async getPublicData() {
 *   return { message: 'This is public data' };
 * }
 * ```
 */
export const SkipSentinel = (): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_OPTIONS_METADATA, { skip: true });
};

/**
 * Decorator to specify a custom strategy for validation
 * 
 * @example
 * ```typescript
 * @SentinelStrategy('premium')
 * @Get('/premium')
 * async getPremiumData() {
 *   return { message: 'This is premium data' };
 * }
 * ```
 */
export const SentinelStrategy = (strategyName: string): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_STRATEGY_METADATA, strategyName);
};

/**
 * Decorator for IP-only validation
 * 
 * @example
 * ```typescript
 * @IPOnly(['192.168.0.0/24', '10.0.0.0/8'])
 * @Get('/internal')
 * async getInternalData() {
 *   return { message: 'Internal data' };
 * }
 * ```
 */
export const IPOnly = (allowedIPs: string[]): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_OPTIONS_METADATA, {
    ip: allowedIPs,
    apiKey: false
  });
};

/**
 * Decorator for API key-only validation
 * 
 * @example
 * ```typescript
 * @APIKeyOnly()
 * @Get('/api-protected')
 * async getAPIProtectedData() {
 *   return { message: 'API protected data' };
 * }
 * ```
 * 
 * @example
 * ```typescript
 * @APIKeyOnly({ header: 'x-custom-api-key', required: true })
 * @Post('/custom-api')
 * async customAPI() {
 *   return { message: 'Custom API response' };
 * }
 * ```
 */
export const APIKeyOnly = (options: { header?: string; query?: string; required?: boolean } = {}): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_OPTIONS_METADATA, {
    apiKey: {
      type: 'apiKey' as const,
      header: options.header,
      query: options.query,
      required: options.required ?? true,
      validateKey: true
    }
  });
};

/**
 * Decorator to allow only private network IPs
 * 
 * @example
 * ```typescript
 * @PrivateNetworkOnly()
 * @Get('/internal-tools')
 * async getInternalTools() {
 *   return { message: 'Internal tools' };
 * }
 * ```
 */
export const PrivateNetworkOnly = (): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_OPTIONS_METADATA, {
    ip: {
      type: 'ip' as const,
      whitelist: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'],
      allowPrivate: true,
      allowLoopback: true
    }
  });
};

/**
 * Decorator to block specific IPs
 * 
 * @example
 * ```typescript
 * @BlockIPs(['192.168.1.100', '10.0.0.50/32'])
 * @Get('/sensitive')
 * async getSensitiveData() {
 *   return { message: 'Sensitive data' };
 * }
 * ```
 */
export const BlockIPs = (blockedIPs: string[]): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_OPTIONS_METADATA, {
    ip: {
      type: 'ip' as const,
      blacklist: blockedIPs
    }
  });
};

/**
 * Decorator for combining IP and API key validation
 * 
 * @example
 * ```typescript
 * @RequireBoth({
 *   allowedIPs: ['192.168.0.0/24'],
 *   apiKeyHeader: 'x-api-key'
 * })
 * @Get('/secure')
 * async getSecureData() {
 *   return { message: 'Secure data' };
 * }
 * ```
 */
export const RequireBoth = (options: {
  allowedIPs: string[];
  apiKeyHeader?: string;
  apiKeyQuery?: string;
}): MethodDecorator & ClassDecorator => {
  return SetMetadata(SENTINEL_OPTIONS_METADATA, {
    ip: options.allowedIPs,
    apiKey: {
      type: 'apiKey' as const,
      header: options.apiKeyHeader,
      query: options.apiKeyQuery,
      required: true,
      validateKey: true
    }
  });
};

/**
 * Utility function to get sentinel options from metadata
 */
export function getSentinelOptions(target: any, propertyKey?: string | symbol): SentinelOptions | undefined {
  if (typeof target === 'function') {
    // Class decorator
    return Reflect.getMetadata(SENTINEL_OPTIONS_METADATA, target);
  } else if (propertyKey) {
    // Method decorator
    return Reflect.getMetadata(SENTINEL_OPTIONS_METADATA, target, propertyKey);
  }
  return undefined;
}

/**
 * Utility function to get strategy name from metadata
 */
export function getSentinelStrategy(target: any, propertyKey?: string | symbol): string | undefined {
  if (typeof target === 'function') {
    // Class decorator
    return Reflect.getMetadata(SENTINEL_STRATEGY_METADATA, target);
  } else if (propertyKey) {
    // Method decorator
    return Reflect.getMetadata(SENTINEL_STRATEGY_METADATA, target, propertyKey);
  }
  return undefined;
}