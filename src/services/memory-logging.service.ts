import { Injectable, Logger, Inject } from "@nestjs/common";
import type {
  TrafficLogData,
  AccessEventData,
  SentinelOptions,
  AccessDecisionType,
} from "../interfaces";
import { SENTINEL_OPTIONS } from "../interfaces";

@Injectable()
export class MemoryLoggingService {
  private readonly logger = new Logger(MemoryLoggingService.name);
  private readonly trafficLogs: TrafficLogData[] = [];
  private readonly accessEvents: AccessEventData[] = [];
  private readonly maxLogEntries = 1000; // Keep only last 1000 entries in memory

  constructor(
    @Inject(SENTINEL_OPTIONS)
    private readonly options: SentinelOptions
  ) {}

  /**
   * Log a request/response
   */
  async logTraffic(logData: TrafficLogData): Promise<void> {
    if (this.options.onTrafficLog) {
      try {
        await this.options.onTrafficLog(logData);
      } catch (error) {
        this.logger.error("Error in custom traffic logger:", error);
      }
    }

    // Store in memory with size limit
    this.trafficLogs.push(logData);
    if (this.trafficLogs.length > this.maxLogEntries) {
      this.trafficLogs.shift(); // Remove oldest entry
    }

    this.logger.debug(
      `Traffic logged: ${logData.method} ${logData.path} - ${logData.statusCode} (${logData.durationMs}ms)`
    );
  }

  /**
   * Log an access event
   */
  async logAccessEvent(
    decision: AccessDecisionType,
    reason: string,
    ip: string,
    clientMac?: string,
    apiKeyId?: string,
    ruleMeta?: Record<string, any>
  ): Promise<void> {
    const eventData: AccessEventData = {
      decision,
      reason,
      ip,
      clientMac,
      apiKeyId,
      ruleMeta,
      timestamp: new Date(),
    };

    if (this.options.onAccessEvent) {
      try {
        await this.options.onAccessEvent(eventData);
      } catch (error) {
        this.logger.error("Error in custom access event logger:", error);
      }
    }

    // Store in memory with size limit
    this.accessEvents.push(eventData);
    if (this.accessEvents.length > this.maxLogEntries) {
      this.accessEvents.shift(); // Remove oldest entry
    }

    this.logger.debug(`Access event logged: ${decision} for ${ip} - ${reason}`);
  }

  /**
   * Get recent traffic logs
   */
  getRecentTrafficLogs(limit = 100): TrafficLogData[] {
    return this.trafficLogs.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get recent access events
   */
  getRecentAccessEvents(limit = 100): AccessEventData[] {
    return this.accessEvents.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get traffic statistics
   */
  getTrafficStats(): {
    totalRequests: number;
    uniqueIps: number;
    averageResponseTime: number;
    statusCodeDistribution: Record<number, number>;
    topEndpoints: Array<{ path: string; count: number }>;
  } {
    const logs = this.trafficLogs;
    const totalRequests = logs.length;
    const uniqueIps = new Set(logs.map((log) => log.ip)).size;
    const averageResponseTime =
      logs.reduce((sum, log) => sum + log.durationMs, 0) / totalRequests || 0;

    const statusCodeDistribution: Record<number, number> = {};
    logs.forEach((log) => {
      statusCodeDistribution[log.statusCode] =
        (statusCodeDistribution[log.statusCode] || 0) + 1;
    });

    // Calculate top endpoints
    const endpointCounts: Record<string, number> = {};
    logs.forEach((log) => {
      const key = log.path;
      endpointCounts[key] = (endpointCounts[key] || 0) + 1;
    });

    const topEndpoints = Object.entries(endpointCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 endpoints

    return {
      totalRequests,
      uniqueIps,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      statusCodeDistribution,
      topEndpoints,
    };
  }

  /**
   * Get access event statistics
   */
  getAccessEventStats(): {
    totalEvents: number;
    allowedEvents: number;
    deniedEvents: number;
    topDeniedReasons: Array<{ reason: string; count: number }>;
  } {
    const events = this.accessEvents;
    const totalEvents = events.length;
    const allowedEvents = events.filter((e) => e.decision === "allow").length;
    const deniedEvents = events.filter((e) => e.decision === "deny").length;

    // Calculate top denied reasons
    const deniedReasonCounts: Record<string, number> = {};
    events
      .filter((e) => e.decision === "deny")
      .forEach((event) => {
        const reason = event.reason;
        deniedReasonCounts[reason] = (deniedReasonCounts[reason] || 0) + 1;
      });

    const topDeniedReasons = Object.entries(deniedReasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 denied reasons

    return {
      totalEvents,
      allowedEvents,
      deniedEvents,
      topDeniedReasons,
    };
  }

  /**
   * Clear all logs (useful for testing)
   */
  clearLogs(): void {
    this.trafficLogs.length = 0;
    this.accessEvents.length = 0;
    this.logger.log("Cleared all logs");
  }
}
