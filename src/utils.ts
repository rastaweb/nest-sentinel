import * as ipaddr from 'ipaddr.js';
import { z } from 'zod';
import { IPAddress, IPRange, IPValidationError } from './interfaces';

/**
 * IP validation utilities
 */
export class IPValidator {
  /**
   * Check if an IP address is valid
   */
  static isValidIP(ip: string): boolean {
    try {
      ipaddr.process(ip);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if an IP is IPv4
   */
  static isIPv4(ip: string): boolean {
    try {
      const addr = ipaddr.process(ip);
      return addr.kind() === 'ipv4';
    } catch {
      return false;
    }
  }

  /**
   * Check if an IP is IPv6
   */
  static isIPv6(ip: string): boolean {
    try {
      const addr = ipaddr.process(ip);
      return addr.kind() === 'ipv6';
    } catch {
      return false;
    }
  }

  /**
   * Check if an IP is private
   */
  static isPrivateIP(ip: string): boolean {
    try {
      const addr = ipaddr.process(ip);
      return addr.range() === 'private';
    } catch {
      return false;
    }
  }

  /**
   * Check if an IP is loopback
   */
  static isLoopbackIP(ip: string): boolean {
    try {
      const addr = ipaddr.process(ip);
      return addr.range() === 'loopback';
    } catch {
      return false;
    }
  }

  /**
   * Check if an IP is in a given range (CIDR notation)
   */
  static isIPInRange(ip: string, range: string): boolean {
    try {
      const addr = ipaddr.process(ip);
      const [rangeIP, prefixLength] = range.split('/');
      
      if (!prefixLength) {
        // Exact match
        return addr.toString() === rangeIP;
      }

      const rangeAddr = ipaddr.process(rangeIP);
      const prefix = parseInt(prefixLength, 10);

      // Ensure both addresses are the same type
      if (addr.kind() !== rangeAddr.kind()) {
        return false;
      }

      return addr.match(rangeAddr, prefix);
    } catch {
      return false;
    }
  }

  /**
   * Check if an IP matches any of the provided patterns
   */
  static matchesPatterns(ip: string, patterns: (IPAddress | IPRange)[]): boolean {
    return patterns.some(pattern => {
      if (pattern.includes('/')) {
        // CIDR range
        return this.isIPInRange(ip, pattern);
      } else {
        // Exact IP match
        return ip === pattern;
      }
    });
  }

  /**
   * Validate IP against whitelist and blacklist
   */
  static validateIP(
    ip: string,
    options: {
      whitelist?: (IPAddress | IPRange)[];
      blacklist?: (IPAddress | IPRange)[];
      allowPrivate?: boolean;
      allowLoopback?: boolean;
    }
  ): { allowed: boolean; reason?: string } {
    const { whitelist, blacklist, allowPrivate = true, allowLoopback = true } = options;

    // Check if IP is valid
    if (!this.isValidIP(ip)) {
      return { allowed: false, reason: 'Invalid IP address format' };
    }

    // Check blacklist first
    if (blacklist && this.matchesPatterns(ip, blacklist)) {
      return { allowed: false, reason: 'IP address is blacklisted' };
    }

    // Check private IP policy
    if (!allowPrivate && this.isPrivateIP(ip)) {
      return { allowed: false, reason: 'Private IP addresses are not allowed' };
    }

    // Check loopback IP policy
    if (!allowLoopback && this.isLoopbackIP(ip)) {
      return { allowed: false, reason: 'Loopback IP addresses are not allowed' };
    }

    // Check whitelist
    if (whitelist && whitelist.length > 0) {
      if (!this.matchesPatterns(ip, whitelist)) {
        return { allowed: false, reason: 'IP address is not in whitelist' };
      }
    }

    return { allowed: true };
  }

  /**
   * Extract client IP from various sources
   */
  static extractClientIP(headers: Record<string, string | string[]>): string {
    // Check common headers for client IP
    const ipHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip', // Cloudflare
      'x-cluster-client-ip',
      'forwarded-for',
      'forwarded'
    ];

    for (const header of ipHeaders) {
      const value = headers[header];
      if (value) {
        const ip = Array.isArray(value) ? value[0] : value;
        // Handle comma-separated IPs (take the first one)
        const cleanIP = ip.split(',')[0].trim();
        if (this.isValidIP(cleanIP)) {
          return cleanIP;
        }
      }
    }

    // Fallback to connection remote address (will be set by framework)
    return headers['x-remote-addr'] as string || '127.0.0.1';
  }
}

/**
 * API Key validation utilities
 */
export class APIKeyValidator {
  /**
   * Extract API key from request headers or query
   */
  static extractAPIKey(
    headers: Record<string, string | string[]>,
    query: Record<string, any>,
    options: { header?: string; query?: string } = {}
  ): string | null {
    const { header = 'x-api-key', query: queryParam = 'apiKey' } = options;

    // Check header first
    const headerValue = headers[header.toLowerCase()];
    if (headerValue) {
      return Array.isArray(headerValue) ? headerValue[0] : headerValue;
    }

    // Check query parameter
    const queryValue = query[queryParam];
    if (queryValue) {
      return Array.isArray(queryValue) ? queryValue[0] : queryValue;
    }

    return null;
  }

  /**
   * Validate API key format (basic validation)
   */
  static isValidFormat(apiKey: string): boolean {
    // Basic validation: non-empty string, reasonable length
    return typeof apiKey === 'string' && 
           apiKey.length >= 8 && 
           apiKey.length <= 256 &&
           /^[a-zA-Z0-9\-_\.]+$/.test(apiKey);
  }

  /**
   * Check if API key is expired based on metadata
   */
  static isExpired(metadata: Record<string, any>): boolean {
    if (!metadata.expiresAt) {
      return false; // No expiration set
    }

    const expirationDate = new Date(metadata.expiresAt);
    return expirationDate < new Date();
  }

  /**
   * Validate API key with metadata
   */
  static validateWithMetadata(
    apiKey: string,
    metadata: Record<string, any> | null
  ): { valid: boolean; reason?: string } {
    if (!metadata) {
      return { valid: false, reason: 'API key not found' };
    }

    if (metadata.disabled) {
      return { valid: false, reason: 'API key is disabled' };
    }

    if (this.isExpired(metadata)) {
      return { valid: false, reason: 'API key has expired' };
    }

    if (metadata.maxRequests && metadata.currentRequests >= metadata.maxRequests) {
      return { valid: false, reason: 'API key rate limit exceeded' };
    }

    return { valid: true };
  }
}

/**
 * Environment validation schema using Zod
 */
export const envValidationSchema = z.object({
  SENTINEL_ENABLED: z.string().optional().default('true'),
  SENTINEL_DEFAULT_STRATEGY: z.string().optional().default('default'),
  SENTINEL_LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional().default('info'),
  SENTINEL_RATE_LIMIT_WINDOW: z.string().optional().default('3600'), // 1 hour in seconds
  SENTINEL_RATE_LIMIT_MAX: z.string().optional().default('1000'),
}).transform(data => ({
  enabled: data.SENTINEL_ENABLED === 'true',
  defaultStrategy: data.SENTINEL_DEFAULT_STRATEGY,
  logLevel: data.SENTINEL_LOG_LEVEL,
  rateLimitWindow: parseInt(data.SENTINEL_RATE_LIMIT_WINDOW, 10),
  rateLimitMax: parseInt(data.SENTINEL_RATE_LIMIT_MAX, 10),
}));

export type EnvConfig = z.infer<typeof envValidationSchema>;

/**
 * Validate environment variables
 */
export function validateEnvironment(): EnvConfig {
  try {
    return envValidationSchema.parse(process.env);
  } catch (error) {
    throw new Error(`Environment validation failed: ${error}`);
  }
}

/**
 * Utility functions for request processing
 */
export class RequestUtils {
  /**
   * Get user agent from headers
   */
  static getUserAgent(headers: Record<string, string | string[]>): string | undefined {
    const userAgent = headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent[0] : userAgent;
  }

  /**
   * Get request timestamp
   */
  static getTimestamp(): number {
    return Date.now();
  }

  /**
   * Generate request ID for tracking
   */
  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  static sanitizeHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
    const sanitized = { ...headers };
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}