import { Injectable, Logger, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { TrafficLog, AccessEvent } from "../entities";
import type {
  TrafficLogData,
  QueryLogsOptions,
  AccessDecisionType,
  AccessTrafficOptions,
} from "../interfaces";
import { ACCESS_TRAFFIC_OPTIONS } from "../interfaces";

@Injectable()
export class TrafficService {
  private readonly logger = new Logger(TrafficService.name);
  private readonly logQueue: TrafficLogData[] = [];
  private readonly accessEventQueue: {
    decision: AccessDecisionType;
    reason: string;
    ip: string;
    clientMac?: string;
    apiKeyId?: string;
    ruleMeta?: Record<string, any>;
  }[] = [];
  private processingLogs = false;
  private retentionDays: number;
  private logProcessorInterval?: NodeJS.Timeout;
  private retentionCleanupInterval?: NodeJS.Timeout;
  private retentionInitialTimeout?: NodeJS.Timeout;

  constructor(
    @InjectRepository(TrafficLog)
    private readonly trafficLogRepository: Repository<TrafficLog>,
    @InjectRepository(AccessEvent)
    private readonly accessEventRepository: Repository<AccessEvent>,
    @Inject(ACCESS_TRAFFIC_OPTIONS)
    private readonly options: AccessTrafficOptions
  ) {
    this.retentionDays = options.trafficRetentionDays || 90;
    this.startLogProcessor();
    this.startRetentionCleanup();
  }

  /**
   * Queue a request log for processing
   */
  async logRequest(logData: TrafficLogData): Promise<void> {
    if (!this.options.enableLogs) {
      return;
    }

    this.logQueue.push(logData);

    // If queue is getting large, process immediately
    if (this.logQueue.length > 100) {
      await this.processLogQueue();
    }
  }

  /**
   * Queue an access event for processing
   */
  async logAccessEvent(
    decision: AccessDecisionType,
    reason: string,
    ip: string,
    clientMac?: string,
    apiKeyId?: string,
    ruleMeta?: Record<string, any>
  ): Promise<void> {
    if (!this.options.enableLogs) {
      return;
    }

    this.accessEventQueue.push({
      decision,
      reason,
      ip,
      clientMac,
      apiKeyId,
      ruleMeta,
    });

    // If queue is getting large, process immediately
    if (this.accessEventQueue.length > 50) {
      await this.processAccessEventQueue();
    }
  }

  /**
   * Query traffic logs with filters
   */
  async queryLogs(options: QueryLogsOptions = {}): Promise<TrafficLog[]> {
    try {
      const queryBuilder = this.trafficLogRepository.createQueryBuilder("log");

      if (options.ip) {
        queryBuilder.andWhere("log.ip = :ip", { ip: options.ip });
      }

      if (options.apiKeyId) {
        queryBuilder.andWhere("log.apiKeyId = :apiKeyId", {
          apiKeyId: options.apiKeyId,
        });
      }

      if (options.route) {
        queryBuilder.andWhere("log.routeName LIKE :route", {
          route: `%${options.route}%`,
        });
      }

      if (options.since) {
        queryBuilder.andWhere("log.timestamp >= :since", {
          since: options.since,
        });
      }

      queryBuilder.orderBy("log.timestamp", "DESC").limit(options.limit || 100);

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error("Error querying logs:", error);
      return [];
    }
  }

  /**
   * Get traffic statistics
   */
  async getTrafficStats(since?: Date): Promise<{
    totalRequests: number;
    uniqueIps: number;
    averageResponseTime: number;
    statusCodeDistribution: Record<number, number>;
  }> {
    try {
      const queryBuilder = this.trafficLogRepository.createQueryBuilder("log");

      if (since) {
        queryBuilder.where("log.timestamp >= :since", { since });
      }

      const logs = await queryBuilder.getMany();

      const totalRequests = logs.length;
      const uniqueIps = new Set(logs.map((log) => log.ip)).size;
      const averageResponseTime =
        logs.reduce((sum, log) => sum + log.durationMs, 0) / totalRequests || 0;

      const statusCodeDistribution: Record<number, number> = {};
      logs.forEach((log) => {
        statusCodeDistribution[log.statusCode] =
          (statusCodeDistribution[log.statusCode] || 0) + 1;
      });

      return {
        totalRequests,
        uniqueIps,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        statusCodeDistribution,
      };
    } catch (error) {
      this.logger.error("Error getting traffic stats:", error);
      return {
        totalRequests: 0,
        uniqueIps: 0,
        averageResponseTime: 0,
        statusCodeDistribution: {},
      };
    }
  }

  /**
   * Start the background log processor
   */
  private startLogProcessor(): void {
    this.logProcessorInterval = setInterval(async () => {
      if (!this.processingLogs && this.logQueue.length > 0) {
        await this.processLogQueue();
      }

      if (this.accessEventQueue.length > 0) {
        await this.processAccessEventQueue();
      }
    }, 5000); // Process every 5 seconds

    // Unref the timer so it doesn't keep the process alive
    this.logProcessorInterval.unref();
  }

  /**
   * Process queued logs
   */
  private async processLogQueue(): Promise<void> {
    if (this.processingLogs || this.logQueue.length === 0) {
      return;
    }

    this.processingLogs = true;

    try {
      const batch = this.logQueue.splice(0, 50); // Process up to 50 at a time
      const logs = batch.map((data) => this.trafficLogRepository.create(data));

      await this.trafficLogRepository.save(logs);

      this.logger.debug(`Processed ${batch.length} traffic logs`);
    } catch (error) {
      this.logger.error("Error processing log queue:", error);
    } finally {
      this.processingLogs = false;
    }
  }

  /**
   * Process queued access events
   */
  private async processAccessEventQueue(): Promise<void> {
    if (this.accessEventQueue.length === 0) {
      return;
    }

    try {
      const batch = this.accessEventQueue.splice(0, 25); // Process up to 25 at a time
      const events = batch.map((data) =>
        this.accessEventRepository.create({
          decision: data.decision,
          reason: data.reason,
          ruleMeta: data.ruleMeta,
          ip: data.ip,
          clientMac: data.clientMac,
          apiKeyId: data.apiKeyId,
        })
      );

      await this.accessEventRepository.save(events);

      this.logger.debug(`Processed ${batch.length} access events`);
    } catch (error) {
      this.logger.error("Error processing access event queue:", error);
    }
  }

  /**
   * Start retention cleanup job
   */
  private startRetentionCleanup(): void {
    // Run cleanup daily
    this.retentionCleanupInterval = setInterval(
      async () => {
        await this.cleanupOldLogs();
      },
      24 * 60 * 60 * 1000
    ); // 24 hours

    // Unref the timer so it doesn't keep the process alive
    this.retentionCleanupInterval.unref();

    // Run initial cleanup after 5 minutes
    this.retentionInitialTimeout = setTimeout(
      () => {
        this.cleanupOldLogs();
      },
      5 * 60 * 1000
    );

    // Unref the timeout so it doesn't keep the process alive
    this.retentionInitialTimeout.unref();
  }

  /**
   * Clean up old logs based on retention policy
   */
  private async cleanupOldLogs(): Promise<void> {
    if (this.retentionDays <= 0) {
      return;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      // Clean up traffic logs
      const deletedLogs = await this.trafficLogRepository.delete({
        timestamp: LessThan(cutoffDate),
      });

      // Clean up access events
      const deletedEvents = await this.accessEventRepository.delete({
        timestamp: LessThan(cutoffDate),
      });

      if (deletedLogs.affected || deletedEvents.affected) {
        this.logger.log(
          `Cleaned up ${deletedLogs.affected || 0} traffic logs and ${deletedEvents.affected || 0} access events older than ${this.retentionDays} days`
        );
      }
    } catch (error) {
      this.logger.error("Error during retention cleanup:", error);
    }
  }

  /**
   * Clean up timers (useful for testing)
   */
  cleanup(): void {
    if (this.logProcessorInterval) {
      clearInterval(this.logProcessorInterval);
      this.logProcessorInterval = undefined;
    }
    if (this.retentionCleanupInterval) {
      clearInterval(this.retentionCleanupInterval);
      this.retentionCleanupInterval = undefined;
    }
    if (this.retentionInitialTimeout) {
      clearTimeout(this.retentionInitialTimeout);
      this.retentionInitialTimeout = undefined;
    }
  }
}
