import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { TrafficService } from "../services/traffic.service";
import type { AccessTrafficOptions, TrafficLogData } from "../interfaces";
import { ACCESS_TRAFFIC_OPTIONS } from "../interfaces";
import { parseClientIp } from "../utils/network.util";

@Injectable()
export class TrackTrafficInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TrackTrafficInterceptor.name);

  constructor(
    private readonly trafficService: TrafficService,
    @Inject(ACCESS_TRAFFIC_OPTIONS)
    private readonly options: AccessTrafficOptions
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.options.enableLogs) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Capture request information
    const clientInfo = parseClientIp(request, this.options.trustProxy);
    const clientMac = this.extractClientMac(request);
    const routeName = this.extractRouteName(context);

    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          await this.logTraffic(
            request,
            response,
            startTime,
            clientInfo,
            clientMac,
            routeName,
            responseData
          );
        },
        error: async (error) => {
          await this.logTraffic(
            request,
            response,
            startTime,
            clientInfo,
            clientMac,
            routeName,
            null,
            error
          );
        },
      })
    );
  }

  /**
   * Log traffic information
   */
  private async logTraffic(
    request: Request,
    response: Response,
    startTime: number,
    clientInfo: { ip: string; ipVersion: "ipv4" | "ipv6" },
    clientMac?: string,
    routeName?: string,
    responseData?: any,
    error?: any
  ): Promise<void> {
    try {
      const endTime = Date.now();
      const durationMs = endTime - startTime;

      // Determine user/service ID from access context or custom identifier
      let userId: string | undefined;
      let serviceId: string | undefined;

      if (request.accessContext) {
        if (request.accessContext.ownerType === "user") {
          userId = request.accessContext.ownerId;
        } else if (request.accessContext.ownerType === "service") {
          serviceId = request.accessContext.ownerId;
        }
      }

      // Use custom identifier function if provided
      if (this.options.identifyUserFromRequest) {
        try {
          const identification =
            await this.options.identifyUserFromRequest(request);
          userId = identification.userId || userId;
          serviceId = identification.serviceId || serviceId;
        } catch (identifyError) {
          this.logger.warn(
            "Error in custom user identification:",
            identifyError
          );
        }
      }

      // Calculate response size
      let responseSize: number | undefined;
      if (responseData) {
        try {
          responseSize = JSON.stringify(responseData).length;
        } catch {
          responseSize = undefined;
        }
      }

      // Sanitize headers (remove sensitive data)
      const sanitizedHeaders = this.sanitizeHeaders(request.headers);

      const logData: TrafficLogData = {
        method: request.method,
        path: request.path,
        statusCode: error ? 500 : response.statusCode || 200,
        durationMs,
        ip: clientInfo.ip,
        ipVersion: clientInfo.ipVersion,
        clientMac,
        apiKeyId: request.accessContext?.apiKeyId,
        serviceId,
        userId,
        requestHeaders: sanitizedHeaders,
        responseSize,
        routeName,
      };

      // Queue the log for async processing
      await this.trafficService.logRequest(logData);
    } catch (logError) {
      this.logger.error("Error logging traffic:", logError);
    }
  }

  /**
   * Extract route name from execution context
   */
  private extractRouteName(context: ExecutionContext): string | undefined {
    try {
      const handler = context.getHandler();
      const controller = context.getClass();

      const controllerName = controller.name;
      const handlerName = handler.name;

      return `${controllerName}.${handlerName}`;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract client MAC address from headers
   */
  private extractClientMac(request: Request): string | undefined {
    const macHeader = this.options.clientMacHeader || "x-client-mac";
    return request.headers[macHeader] as string;
  }

  /**
   * Sanitize request headers (remove sensitive information)
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
      "x-access-token",
    ];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = "[REDACTED]";
      }
      if (sanitized[header.toLowerCase()]) {
        sanitized[header.toLowerCase()] = "[REDACTED]";
      }
    });

    return sanitized;
  }
}
