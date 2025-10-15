import { SetMetadata } from '@nestjs/common';
import { AccessRuleOptions, ACCESS_RULE_METADATA } from '../interfaces';

/**
 * Decorator to set access rules for controllers or methods
 */
export const AccessRule = (options: AccessRuleOptions) =>
  SetMetadata(ACCESS_RULE_METADATA, options);

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
    ipVersion: 'ipv4',
  });

/**
 * Decorator to require IPv6 only
 */
export const IPv6Only = () =>
  AccessRule({
    ipVersion: 'ipv6',
  });
