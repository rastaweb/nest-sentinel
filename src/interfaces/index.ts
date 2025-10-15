export type OwnerType = "user" | "service";
export type AccessDecisionType = "allow" | "deny";

export interface AccessPolicy {
  ipWhitelist?: string[];
  requireApiKey?: boolean;
  allowedMacs?: string[];
  deniedIps?: string[];
}

export interface SentinelOptions {
  dbUrl?: string;
  autoMigrate?: boolean;
  enableLogs?: boolean;
  globalPolicy?: AccessPolicy;
  apiKeyHeader?: string;
  clientMacHeader?: string;
  trustProxy?: boolean;
  trafficRetentionDays?: number;
  serviceAuth?: {
    enabled: boolean;
    requiredScopes?: string[];
  };
  identifyUserFromRequest?: (
    req: any
  ) => Promise<{ userId?: string; serviceId?: string }>;
}

export interface AddressMatch {
  anyOf?: string[];
  allOf?: string[];
}

export interface AccessRuleOptions {
  allow?: Array<string | AddressMatch>;
  deny?: Array<string | AddressMatch>;
  require?: {
    apiKey?: boolean;
    scopes?: string[];
    combined?: Array<"ip" | "mac" | "apiKey" | "ipVersion">;
  };
  ipVersion?: "ipv4" | "ipv6" | "any";
  note?: string;
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

export interface QueryLogsOptions {
  ip?: string;
  apiKeyId?: string;
  since?: Date;
  limit?: number;
  route?: string;
}

// Constants
export const SENTINEL_OPTIONS = Symbol("SENTINEL_OPTIONS");
export const ACCESS_RULE_METADATA = Symbol("ACCESS_RULE_METADATA");

// Default values
export const DEFAULT_OPTIONS: Partial<SentinelOptions> = {
  autoMigrate: false,
  enableLogs: true,
  apiKeyHeader: "x-api-key",
  clientMacHeader: "x-client-mac",
  trustProxy: true,
  trafficRetentionDays: 90,
  serviceAuth: {
    enabled: true,
    requiredScopes: [],
  },
};
