import { SetMetadata, applyDecorators } from "@nestjs/common";
import {
  AccessRuleOptions,
  ACCESS_RULE_METADATA,
  SKIP_SENTINEL_GUARD,
  SKIP_TRAFFIC_LOGGING,
  SKIP_ACCESS_LOGGING,
} from "../interfaces";

/**
 * Decorator to set access rules for controllers or methods
 */
export const AccessRule = (options: AccessRuleOptions) =>
  SetMetadata(ACCESS_RULE_METADATA, options);

/**
 * Decorator to skip Sentinel guard entirely for this route
 * Similar to @SkipThrottle() in throttle packages
 */
export const SkipSentinel = () => SetMetadata(SKIP_SENTINEL_GUARD, true);

/**
 * Decorator to skip traffic logging for this route
 */
export const SkipTrafficLogging = () => SetMetadata(SKIP_TRAFFIC_LOGGING, true);

/**
 * Decorator to skip access event logging for this route
 */
export const SkipAccessLogging = () => SetMetadata(SKIP_ACCESS_LOGGING, true);

/**
 * Decorator to skip all Sentinel features for this route
 * Equivalent to @SkipSentinel() + @SkipTrafficLogging() + @SkipAccessLogging()
 */
export const SkipAllSentinel = () =>
  applyDecorators(
    SetMetadata(SKIP_SENTINEL_GUARD, true),
    SetMetadata(SKIP_TRAFFIC_LOGGING, true),
    SetMetadata(SKIP_ACCESS_LOGGING, true)
  );

/**
 * Decorator to require API key authentication
 */
export const RequireApiKey = (scopes?: string[]) =>
  AccessRule({
    require: {
      apiKey: true,
      scopes,
    },
  });

/**
 * Decorator to allow specific IPs
 */
export const AllowIps = (ips: string[]) =>
  AccessRule({
    allow: ips,
  });

/**
 * Decorator to deny specific IPs
 */
export const DenyIps = (ips: string[]) =>
  AccessRule({
    deny: ips,
  });

/**
 * Decorator to require IPv4 only
 */
export const IPv4Only = () =>
  AccessRule({
    ipVersion: "ipv4",
  });

/**
 * Decorator to require IPv6 only
 */
export const IPv6Only = () =>
  AccessRule({
    ipVersion: "ipv6",
  });

/**
 * Decorator to allow specific MAC addresses
 */
export const AllowMacs = (macs: string[]) =>
  AccessRule({
    allow: macs.map((mac) => `MAC:${mac}`),
  });

/**
 * Decorator to deny specific MAC addresses
 */
export const DenyMacs = (macs: string[]) =>
  AccessRule({
    deny: macs.map((mac) => `MAC:${mac}`),
  });

/**
 * Decorator for complex access rules with AND logic
 */
export const RequireAll = (
  requirements: Array<"ip" | "mac" | "apiKey" | "ipVersion">
) =>
  AccessRule({
    require: {
      combined: requirements,
    },
  });

/**
 * Decorator to enable rate limiting (future enhancement)
 */
export const RateLimit = (requests: number, windowMs: number) =>
  AccessRule({
    rateLimit: {
      requests,
      windowMs,
    },
  });
