import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { MemoryApiKeyService } from "../services/memory-api-key.service";
import { MemoryLoggingService } from "../services/memory-logging.service";
import {
  AccessRuleOptions,
  type SentinelOptions,
  ACCESS_RULE_METADATA,
  SENTINEL_OPTIONS,
  SKIP_SENTINEL_GUARD,
  SKIP_ACCESS_LOGGING,
  ClientInfo,
  AccessDecision,
  AccessContext,
  AddressMatch,
} from "../interfaces";
import {
  parseClientIp,
  matchIpOrRange,
  matchMac,
  normalizeMac,
} from "../utils/network.util";

// Extend Request interface to include access context
declare module "express" {
  interface Request {
    accessContext?: AccessContext;
  }
}

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: MemoryApiKeyService,
    private readonly loggingService: MemoryLoggingService,
    @Inject(SENTINEL_OPTIONS)
    private readonly options: SentinelOptions
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check global skip configuration
    if (this.options.skipGlobalGuards) {
      this.logger.debug("Skipping Sentinel guard due to global configuration");
      return true;
    }

    // Check route-specific skip configuration
    const shouldSkipGuard = this.reflector.getAllAndOverride<boolean>(
      SKIP_SENTINEL_GUARD,
      [context.getHandler(), context.getClass()]
    );

    if (shouldSkipGuard) {
      this.logger.debug("Skipping Sentinel guard for this route");
      return true;
    }

    // Get access rule from decorator metadata
    const accessRule = this.reflector.getAllAndOverride<AccessRuleOptions>(
      ACCESS_RULE_METADATA,
      [context.getHandler(), context.getClass()]
    );

    // Check if this route specifically skips guards via AccessRule
    if (accessRule?.skipGuard) {
      this.logger.debug(
        "Skipping Sentinel guard due to AccessRule configuration"
      );
      return true;
    }

    // Parse client information
    const clientInfo = parseClientIp(request, this.options.trustProxy);
    const clientMac = this.extractClientMac(request);

    const fullClientInfo: ClientInfo = {
      ...clientInfo,
      mac: clientMac,
    };

    try {
      // Evaluate access rules
      const decision = await this.evaluateAccess(
        request,
        fullClientInfo,
        accessRule
      );

      // Check if we should skip access logging
      const shouldSkipAccessLogging = this.shouldSkipAccessLogging(
        context,
        accessRule
      );

      // Log the access decision (if not skipped)
      if (!shouldSkipAccessLogging) {
        await this.loggingService.logAccessEvent(
          decision.decision,
          decision.reason,
          clientInfo.ip,
          clientMac,
          request.accessContext?.apiKeyId,
          decision.ruleMeta
        );
      }

      if (decision.decision === "deny") {
        const detailedReason = this.buildDetailedErrorMessage(
          decision,
          clientInfo
        );
        this.logger.warn(
          `Access denied for ${clientInfo.ip}: ${detailedReason}`
        );
        throw new ForbiddenException(detailedReason);
      }

      this.logger.debug(
        `Access granted for ${clientInfo.ip}: ${decision.reason}`
      );
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error("Error evaluating access:", error);
      throw new ForbiddenException("Access evaluation failed");
    }
  }

  /**
   * Evaluate access based on rules and global policy
   */
  private async evaluateAccess(
    request: Request,
    clientInfo: ClientInfo,
    accessRule?: AccessRuleOptions
  ): Promise<AccessDecision> {
    const rules = {
      ...this.options.globalPolicy,
      ...accessRule,
    };

    // Check IP version requirements
    if (rules.ipVersion && rules.ipVersion !== "any") {
      if (clientInfo.ipVersion !== rules.ipVersion) {
        return {
          decision: "deny",
          reason: `IP version ${clientInfo.ipVersion} not allowed`,
          ruleMeta: { requiredVersion: rules.ipVersion },
        };
      }
    }

    // Check deny rules first (takes precedence)
    if (rules.deny && rules.deny.length > 0) {
      const denyMatch = this.evaluateAddressRules(
        clientInfo,
        rules.deny,
        "deny"
      );
      if (denyMatch.matches) {
        return {
          decision: "deny",
          reason: denyMatch.reason,
          ruleMeta: { rule: "deny", pattern: denyMatch.pattern },
        };
      }
    }

    // Check allow rules
    if (rules.allow && rules.allow.length > 0) {
      const allowMatch = this.evaluateAddressRules(
        clientInfo,
        rules.allow,
        "allow"
      );
      if (!allowMatch.matches) {
        return {
          decision: "deny",
          reason: "IP/MAC not in allow list",
          ruleMeta: { rule: "allow" },
        };
      }
    }

    // Check API key requirements
    if (rules.require?.apiKey) {
      const apiKeyResult = await this.validateApiKey(request, rules.require);
      if (!apiKeyResult.valid) {
        return {
          decision: "deny",
          reason: apiKeyResult.reason || "API key validation failed",
          ruleMeta: { rule: "apiKey" },
        };
      }
    }

    // Check combined requirements
    if (rules.require?.combined && rules.require.combined.length > 0) {
      const combinedResult = await this.evaluateCombinedRequirements(
        request,
        clientInfo,
        rules.require.combined
      );
      if (!combinedResult.valid) {
        return {
          decision: "deny",
          reason: combinedResult.reason || "Combined requirements not met",
          ruleMeta: { rule: "combined", requirements: rules.require.combined },
        };
      }
    }

    return {
      decision: "allow",
      reason: "All access rules passed",
    };
  }

  /**
   * Evaluate address-based rules (IP/MAC allow/deny)
   */
  private evaluateAddressRules(
    clientInfo: ClientInfo,
    rules: Array<string | AddressMatch>,
    ruleType: "allow" | "deny"
  ): { matches: boolean; reason: string; pattern?: string } {
    for (const rule of rules) {
      if (typeof rule === "string") {
        // Simple string pattern
        if (this.matchAddressPattern(clientInfo, rule)) {
          return {
            matches: true,
            reason: `${ruleType} rule matched: ${rule}`,
            pattern: rule,
          };
        }
      } else {
        // Complex rule with anyOf/allOf
        if (rule.anyOf) {
          const anyMatch = rule.anyOf.some((pattern) =>
            this.matchAddressPattern(clientInfo, pattern)
          );
          if (anyMatch) {
            return {
              matches: true,
              reason: `${ruleType} rule anyOf matched`,
              pattern: rule.anyOf.join(" OR "),
            };
          }
        }

        if (rule.allOf) {
          const allMatch = rule.allOf.every((pattern) =>
            this.matchAddressPattern(clientInfo, pattern)
          );
          if (allMatch) {
            return {
              matches: true,
              reason: `${ruleType} rule allOf matched`,
              pattern: rule.allOf.join(" AND "),
            };
          }
        }
      }
    }

    return {
      matches: false,
      reason: `No ${ruleType} rule matched`,
    };
  }

  /**
   * Match client info against an address pattern
   */
  private matchAddressPattern(
    clientInfo: ClientInfo,
    pattern: string
  ): boolean {
    // Check for MAC pattern
    if (pattern.toUpperCase().startsWith("MAC:")) {
      const macPattern = pattern.substring(4);
      return clientInfo.mac ? matchMac(clientInfo.mac, macPattern) : false;
    }

    // Check IP pattern
    return matchIpOrRange(clientInfo.ip, pattern);
  }

  /**
   * Validate API key and set context
   */
  private async validateApiKey(
    request: Request,
    requirements: NonNullable<AccessRuleOptions["require"]>
  ): Promise<{ valid: boolean; reason?: string }> {
    const apiKeyHeader = this.options.apiKeyHeader || "x-api-key";
    const apiKey = request.headers[apiKeyHeader] as string;

    if (!apiKey) {
      return { valid: false, reason: "API key required but not provided" };
    }

    // Check if any required scopes
    const requiredScopes = requirements.scopes; // Pass all required scopes
    const result = await this.apiKeyService.validateKey(apiKey, requiredScopes);

    if (result.valid && result.apiKeyRecord) {
      // Set access context
      request.accessContext = {
        apiKeyId: result.apiKeyRecord.id,
        ownerType: result.apiKeyRecord.ownerType,
        ownerId: result.apiKeyRecord.ownerId,
        scopes: result.apiKeyRecord.scopes,
      };

      // Check all required scopes
      if (requirements.scopes && requirements.scopes.length > 0) {
        const hasAllScopes = requirements.scopes.every((scope) =>
          result.apiKeyRecord!.scopes.includes(scope)
        );
        if (!hasAllScopes) {
          return {
            valid: false,
            reason: `Missing required scopes: ${requirements.scopes.join(", ")}`,
          };
        }
      }

      return { valid: true };
    }

    return { valid: false, reason: result.error };
  }

  /**
   * Evaluate combined requirements (all must be true)
   */
  private async evaluateCombinedRequirements(
    request: Request,
    clientInfo: ClientInfo,
    requirements: Array<"ip" | "mac" | "apiKey" | "ipVersion">
  ): Promise<{ valid: boolean; reason?: string }> {
    for (const requirement of requirements) {
      switch (requirement) {
        case "ip":
          if (!clientInfo.ip || clientInfo.ip === "127.0.0.1") {
            return { valid: false, reason: "Valid IP required" };
          }
          break;

        case "mac":
          if (!clientInfo.mac) {
            return { valid: false, reason: "MAC address required" };
          }
          break;

        case "apiKey":
          if (!request.accessContext?.apiKeyId) {
            return { valid: false, reason: "Valid API key required" };
          }
          break;

        case "ipVersion":
          if (!clientInfo.ipVersion) {
            return {
              valid: false,
              reason: "IP version determination required",
            };
          }
          break;
      }
    }

    return { valid: true };
  }

  /**
   * Extract client MAC address from headers
   */
  private extractClientMac(request: Request): string | undefined {
    const macHeader = this.options.clientMacHeader || "x-client-mac";
    const mac = request.headers[macHeader] as string;
    return mac ? normalizeMac(mac) : undefined;
  }

  /**
   * Determine if access logging should be skipped for this request
   * Follows Single Responsibility Principle - dedicated method for skip logic
   */
  private shouldSkipAccessLogging(
    context: ExecutionContext,
    accessRule?: AccessRuleOptions
  ): boolean {
    // Check route-specific skip configuration via decorator
    const shouldSkipViaDecorator = this.reflector.getAllAndOverride<boolean>(
      SKIP_ACCESS_LOGGING,
      [context.getHandler(), context.getClass()]
    );

    if (shouldSkipViaDecorator) {
      return true;
    }

    // Check route-specific skip configuration via AccessRule
    if (accessRule?.skipAccessLogging) {
      return true;
    }

    return false;
  }

  /**
   * Build detailed error message for better developer experience
   */
  private buildDetailedErrorMessage(
    decision: AccessDecision,
    clientInfo: ClientInfo
  ): string {
    const baseMessage = decision.reason;

    if (decision.ruleMeta?.rule === "allow") {
      return `${baseMessage}. Your IP ${clientInfo.ip} (${clientInfo.ipVersion}) is not in the allowed list.`;
    }

    if (decision.ruleMeta?.rule === "deny") {
      return `${baseMessage}. Your IP ${clientInfo.ip} matches a deny rule: ${decision.ruleMeta.pattern}`;
    }

    if (decision.ruleMeta?.rule === "apiKey") {
      return `${baseMessage}. Please provide a valid API key in the '${this.options.apiKeyHeader || "x-api-key"}' header.`;
    }

    if (decision.ruleMeta?.rule === "combined") {
      const requirements = decision.ruleMeta.requirements as string[];
      return `${baseMessage}. This endpoint requires: ${requirements.join(", ")}.`;
    }

    return baseMessage;
  }
}
