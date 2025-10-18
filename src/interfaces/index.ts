export type OwnerType = "user" | "service";
export type AccessDecisionType = "allow" | "deny";

export interface AccessPolicy {
  ipWhitelist?: string[];
  requireApiKey?: boolean;
  allowedMacs?: string[];
  deniedIps?: string[];
}

export interface SentinelOptions {
  /** Global access policy applied to all routes */
  globalPolicy?: AccessPolicy;
  /** HTTP header name for API keys (default: 'x-api-key') */
  apiKeyHeader?: string;
  /** HTTP header name for client MAC addresses (default: 'x-client-mac') */
  clientMacHeader?: string;
  /** Trust proxy headers for IP detection (default: true) */
  trustProxy?: boolean;
  /** Skip all guards globally - useful for development */
  skipGlobalGuards?: boolean;
  /** Service authentication configuration */
  serviceAuth?: {
    enabled: boolean;
    requiredScopes?: string[];
  };
  /** Custom function to identify users/services from requests */
  identifyUserFromRequest?: (
    req: any
  ) => Promise<{ userId?: string; serviceId?: string }>;
  /** Custom API key validator function */
  validateApiKey?: (
    key: string,
    requiredScopes?: string[]
  ) => Promise<ValidationResult>;
  /** Custom access event logger */
  onAccessEvent?: (event: AccessEventData) => Promise<void> | void;
  /** Custom traffic logger */
  onTrafficLog?: (logData: TrafficLogData) => Promise<void> | void;
}

export interface AddressMatch {
  anyOf?: string[];
  allOf?: string[];
}

export interface AccessRuleOptions {
  /** IP/MAC addresses to allow access */
  allow?: Array<string | AddressMatch>;
  /** IP/MAC addresses to deny access (takes precedence over allow) */
  deny?: Array<string | AddressMatch>;
  /** Requirements that must be met for access */
  require?: {
    /** Require a valid API key */
    apiKey?: boolean;
    /** Required API key scopes */
    scopes?: string[];
    /** Combined requirements (all must be true) */
    combined?: Array<"ip" | "mac" | "apiKey" | "ipVersion">;
  };
  /** Required IP version (default: 'any') */
  ipVersion?: "ipv4" | "ipv6" | "any";
  /** Human-readable description of this rule */
  note?: string;
  /** Skip access guard for this route */
  skipGuard?: boolean;
  /** Skip traffic logging for this route */
  skipTrafficLogging?: boolean;
  /** Skip access event logging for this route */
  skipAccessLogging?: boolean;
  /** Rate limiting configuration (future enhancement) */
  rateLimit?: {
    requests: number;
    windowMs: number;
    skipSuccessfulRequests?: boolean;
  };
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  ownerType: OwnerType;
  ownerId: string;
  scopes: string[];
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

export interface ValidationResult {
  valid: boolean;
  apiKeyRecord?: ApiKeyRecord;
  error?: string;
}

export interface AccessContext {
  apiKeyId?: string;
  ownerType?: OwnerType;
  ownerId?: string;
  scopes?: string[];
}

export interface ClientInfo {
  ip: string;
  ipVersion: "ipv4" | "ipv6";
  mac?: string;
}

export interface AccessDecision {
  decision: "allow" | "deny";
  reason: string;
  ruleMeta?: Record<string, any>;
}

export interface TrafficLogData {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  ipVersion: "ipv4" | "ipv6";
  clientMac?: string;
  apiKeyId?: string;
  serviceId?: string;
  userId?: string;
  requestHeaders: Record<string, any>;
  responseSize?: number;
  routeName?: string;
}

export interface AccessEventData {
  decision: "allow" | "deny";
  reason: string;
  ip: string;
  clientMac?: string;
  apiKeyId?: string;
  ruleMeta?: Record<string, any>;
  timestamp?: Date;
}

export interface QueryLogsOptions {
  ip?: string;
  apiKeyId?: string;
  since?: Date;
  limit?: number;
  route?: string;
}

/** Webhook configuration for security events */
export interface WebhookConfig {
  /** Webhook URL to send events to */
  url: string;
  /** Secret for webhook signature verification */
  secret?: string;
  /** Events to send (default: all) */
  events?: Array<
    "access_denied" | "key_created" | "key_rotated" | "suspicious_activity"
  >;
  /** Custom headers to include */
  headers?: Record<string, string>;
  /** Retry configuration */
  retries?: {
    count: number;
    delay: number;
  };
}

/** Statistics aggregation interface */
export interface TrafficStats {
  totalRequests: number;
  uniqueIps: number;
  averageResponseTime: number;
  statusCodeDistribution: Record<number, number>;
  topEndpoints: Array<{ path: string; count: number }>;
  securityEvents: {
    denied: number;
    allowed: number;
    suspiciousActivity: number;
  };
}

// Constants
export const SENTINEL_OPTIONS = Symbol("SENTINEL_OPTIONS");
export const ACCESS_RULE_METADATA = Symbol("ACCESS_RULE_METADATA");
export const SKIP_SENTINEL_GUARD = Symbol("SKIP_SENTINEL_GUARD");
export const SKIP_TRAFFIC_LOGGING = Symbol("SKIP_TRAFFIC_LOGGING");
export const SKIP_ACCESS_LOGGING = Symbol("SKIP_ACCESS_LOGGING");

// Default values
export const DEFAULT_OPTIONS: Partial<SentinelOptions> = {
  apiKeyHeader: "x-api-key",
  clientMacHeader: "x-client-mac",
  trustProxy: true,
  skipGlobalGuards: false,
  serviceAuth: {
    enabled: true,
    requiredScopes: [],
  },
};
