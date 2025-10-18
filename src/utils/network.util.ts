import { Request } from "express";
import * as ipaddr from "ipaddr.js";

export interface ParsedClientInfo {
  ip: string;
  ipVersion: "ipv4" | "ipv6";
}

/**
 * Parse client IP address from request, considering proxy headers
 */
export function parseClientIp(
  req: Request,
  trustProxy = true
): ParsedClientInfo {
  let clientIp: string;

  if (trustProxy) {
    // Check X-Forwarded-For header first
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      clientIp = ips.split(",")[0].trim();
    } else if (req.headers["x-real-ip"]) {
      clientIp = req.headers["x-real-ip"] as string;
    } else {
      clientIp = req.ip || req.connection.remoteAddress || "127.0.0.1";
    }
  } else {
    clientIp = req.ip || req.connection.remoteAddress || "127.0.0.1";
  }

  // Clean up IPv4-mapped IPv6 addresses
  if (clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }

  // Determine IP version
  let ipVersion: "ipv4" | "ipv6";
  try {
    const addr = ipaddr.process(clientIp);
    ipVersion = addr.kind();
  } catch {
    // Fallback for invalid IPs
    ipVersion = clientIp.includes(":") ? "ipv6" : "ipv4";
  }

  return {
    ip: clientIp,
    ipVersion,
  };
}

/**
 * Check if an IP matches a pattern (IP, CIDR, or 'any')
 */
export function matchIpOrRange(value: string, pattern: string): boolean {
  if (pattern === "any" || pattern === "*") {
    return true;
  }

  try {
    if (pattern.includes("/")) {
      // For CIDR matching, use ipaddr.js for proper IPv4/IPv6 support
      const [rangeIp, prefixStr] = pattern.split("/");
      const prefix = parseInt(prefixStr, 10);

      // Use ipaddr.js for proper CIDR matching
      const addr = ipaddr.process(value);
      const range = ipaddr.process(rangeIp);

      if (addr.kind() === range.kind()) {
        if (addr.kind() === "ipv4") {
          return addr.match(ipaddr.IPv4.parse(rangeIp), prefix);
        } else {
          return addr.match(ipaddr.IPv6.parse(rangeIp), prefix);
        }
      }

      return false;
    } else {
      // Exact IP match
      return value === pattern;
    }
  } catch {
    // Fallback: Simple IPv4 CIDR matching for compatibility
    if (
      pattern.includes("/") &&
      !value.includes(":") &&
      !pattern.includes(":")
    ) {
      const [rangeIp, prefixStr] = pattern.split("/");
      const prefix = parseInt(prefixStr, 10);

      if (prefix >= 0 && prefix <= 32) {
        const valueNum = ipToNumber(value);
        const rangeNum = ipToNumber(rangeIp);
        const mask = (0xffffffff << (32 - prefix)) >>> 0;
        return (valueNum & mask) === (rangeNum & mask);
      }
    }

    // Final fallback to string comparison
    return value === pattern;
  }
}

/**
 * Convert IPv4 address to number for CIDR calculations
 */
function ipToNumber(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Normalize MAC address to standard format
 */
export function normalizeMac(value: string): string {
  if (!value) return "";

  // Remove common prefixes
  const cleaned = value.replace(/^MAC:/i, "");

  // Remove all separators and convert to uppercase
  const hexOnly = cleaned.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();

  // Ensure we have 12 hex characters
  if (hexOnly.length !== 12) {
    return "";
  }

  // Format as XX-XX-XX-XX-XX-XX
  return hexOnly.replace(/(.{2})/g, "$1-").replace(/-$/, "");
}

/**
 * Check if a MAC address matches a pattern
 */
export function matchMac(value: string, pattern: string): boolean {
  if (!value || !pattern) return false;

  const normalizedValue = normalizeMac(value);
  const normalizedPattern = normalizeMac(pattern);

  return normalizedValue === normalizedPattern;
}

/**
 * Check if an IP is IPv4
 */
export function isIPv4(ip: string): boolean {
  try {
    const addr = ipaddr.process(ip);
    return addr.kind() === "ipv4";
  } catch {
    return false;
  }
}

/**
 * Check if an IP is IPv6
 */
export function isIPv6(ip: string): boolean {
  try {
    const addr = ipaddr.process(ip);
    return addr.kind() === "ipv6";
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid IP address
 */
export function isValidIp(ip: string): boolean {
  try {
    ipaddr.process(ip);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid CIDR range
 */
export function isValidCidr(cidr: string): boolean {
  try {
    if (!cidr.includes("/")) return false;

    const [ip, prefixStr] = cidr.split("/");
    const prefix = parseInt(prefixStr, 10);

    // Validate IP part
    const addr = ipaddr.process(ip);

    // Validate prefix length
    if (addr.kind() === "ipv4") {
      return prefix >= 0 && prefix <= 32;
    } else {
      return prefix >= 0 && prefix <= 128;
    }
  } catch {
    return false;
  }
}
