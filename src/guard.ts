import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  Logger
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  SentinelConfig,
  SentinelOptions,
  ValidationContext,
  ValidationResult,
  SentinelStrategy
} from './interfaces';
import {
  SENTINEL_OPTIONS_METADATA,
  SENTINEL_STRATEGY_METADATA,
  SENTINEL_CONFIG_TOKEN,
  DEFAULT_API_KEY_HEADER,
  ERROR_CODES
} from './constants';
import { IPValidator, APIKeyValidator, RequestUtils } from './utils';
import { StrategyRegistry } from './strategies';

/**
 * Main guard that handles sentinel validation
 */
@Injectable()
export class SentinelGuard implements CanActivate {
  private readonly logger = new Logger(SentinelGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly strategyRegistry: StrategyRegistry,
    @Inject(SENTINEL_CONFIG_TOKEN) private readonly config: SentinelConfig
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if sentinel is globally disabled
    if (this.config.enabled === false) {
      this.logger.debug('Sentinel validation is globally disabled');
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    // Get route-specific options
    const routeOptions = this.getRouteOptions(context);
    
    // Check if validation should be skipped for this route
    if (routeOptions?.skip) {
      this.logger.debug('Sentinel validation skipped for this route');
      return true;
    }

    try {
      // Build validation context
      const validationContext = this.buildValidationContext(request, routeOptions);
      
      // Get the appropriate strategy
      const strategy = this.getStrategy(context, routeOptions);
      
      if (!strategy) {
        this.logger.error('No validation strategy found');
        throw new ForbiddenException('Validation strategy not available');
      }

      // Perform validation
      const result = await strategy.validate(validationContext);
      
      // Log the validation result
      this.logValidationResult(validationContext, result, strategy.name);
      
      // Handle validation result
      if (!result.allowed) {
        this.handleValidationFailure(result, validationContext);
        return false;
      }

      // Add validation metadata to request for potential use by other guards/interceptors
      (request as any).sentinelValidation = {
        strategy: strategy.name,
        result,
        context: validationContext
      };

      return true;
    } catch (error) {
      this.logger.error(`Sentinel validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      
      // For unexpected errors, deny access by default
      throw new ForbiddenException('Access validation failed');
    }
  }

  /**
   * Get route-specific sentinel options from metadata
   */
  private getRouteOptions(context: ExecutionContext): SentinelOptions | undefined {
    // Check method-level metadata first
    const methodOptions = this.reflector.get<SentinelOptions>(
      SENTINEL_OPTIONS_METADATA,
      context.getHandler()
    );

    if (methodOptions) {
      return methodOptions;
    }

    // Fall back to class-level metadata
    const classOptions = this.reflector.get<SentinelOptions>(
      SENTINEL_OPTIONS_METADATA,
      context.getClass()
    );

    return classOptions;
  }

  /**
   * Build validation context from request
   */
  private buildValidationContext(request: Request, routeOptions?: SentinelOptions): ValidationContext {
    // Extract client IP
    const clientIP = IPValidator.extractClientIP(request.headers);
    
    // Extract API key
    const apiKey = APIKeyValidator.extractAPIKey(
      request.headers,
      request.query,
      {
        header: routeOptions?.apiKey && typeof routeOptions.apiKey === 'object' 
          ? routeOptions.apiKey.header 
          : DEFAULT_API_KEY_HEADER,
        query: routeOptions?.apiKey && typeof routeOptions.apiKey === 'object'
          ? routeOptions.apiKey.query
          : undefined
      }
    );

    return {
      clientIP,
      apiKey: apiKey || undefined,
      headers: request.headers,
      query: request.query,
      routeOptions,
      userAgent: RequestUtils.getUserAgent(request.headers),
      metadata: {
        timestamp: RequestUtils.getTimestamp(),
        requestId: RequestUtils.generateRequestId(),
        method: request.method,
        url: request.url,
        route: request.route?.path
      }
    };
  }

  /**
   * Get the appropriate validation strategy
   */
  private getStrategy(context: ExecutionContext, routeOptions?: SentinelOptions): SentinelStrategy | undefined {
    // Check for route-specific strategy
    if (routeOptions?.strategy) {
      const strategy = this.strategyRegistry.get(routeOptions.strategy);
      if (strategy) {
        return strategy;
      }
      this.logger.warn(`Route-specific strategy '${routeOptions.strategy}' not found, falling back to default`);
    }

    // Check for method-level strategy metadata
    const methodStrategy = this.reflector.get<string>(
      SENTINEL_STRATEGY_METADATA,
      context.getHandler()
    );

    if (methodStrategy) {
      const strategy = this.strategyRegistry.get(methodStrategy);
      if (strategy) {
        return strategy;
      }
      this.logger.warn(`Method-level strategy '${methodStrategy}' not found, falling back to default`);
    }

    // Check for class-level strategy metadata
    const classStrategy = this.reflector.get<string>(
      SENTINEL_STRATEGY_METADATA,
      context.getClass()
    );

    if (classStrategy) {
      const strategy = this.strategyRegistry.get(classStrategy);
      if (strategy) {
        return strategy;
      }
      this.logger.warn(`Class-level strategy '${classStrategy}' not found, falling back to default`);
    }

    // Fall back to configured default strategy
    const defaultStrategyName = this.config.defaultStrategy || 'default';
    return this.strategyRegistry.get(defaultStrategyName);
  }

  /**
   * Handle validation failure by throwing appropriate exception
   */
  private handleValidationFailure(result: ValidationResult, context: ValidationContext): never {
    const { reason, metadata } = result;
    const errorMessage = reason || 'Access denied';

    // Determine appropriate exception type based on the failure reason
    if (reason?.includes('API key') || reason?.includes('key')) {
      throw new UnauthorizedException({
        message: errorMessage,
        code: ERROR_CODES.API_KEY_INVALID,
        metadata: {
          ...metadata,
          clientIP: context.clientIP,
          timestamp: Date.now()
        }
      });
    }

    if (reason?.includes('IP') || reason?.includes('address')) {
      throw new ForbiddenException({
        message: errorMessage,
        code: ERROR_CODES.IP_NOT_ALLOWED,
        metadata: {
          ...metadata,
          clientIP: context.clientIP,
          timestamp: Date.now()
        }
      });
    }

    // Generic forbidden exception
    throw new ForbiddenException({
      message: errorMessage,
      code: ERROR_CODES.VALIDATION_FAILED,
      metadata: {
        ...metadata,
        clientIP: context.clientIP,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Log validation result for monitoring and debugging
   */
  private logValidationResult(
    context: ValidationContext,
    result: ValidationResult,
    strategyName: string
  ): void {
    const logData = {
      strategy: strategyName,
      clientIP: context.clientIP,
      userAgent: context.userAgent,
      method: context.metadata?.method,
      url: context.metadata?.url,
      allowed: result.allowed,
      reason: result.reason,
      timestamp: new Date().toISOString(),
      requestId: context.metadata?.requestId
    };

    if (result.allowed) {
      this.logger.log(`Access granted: ${JSON.stringify(logData)}`);
    } else {
      this.logger.warn(`Access denied: ${JSON.stringify(logData)}`);
    }
  }
}

/**
 * Factory function to create a configured SentinelGuard
 */
export function createSentinelGuard(
  config: SentinelConfig,
  strategyRegistry: StrategyRegistry
): typeof SentinelGuard {
  @Injectable()
  class ConfiguredSentinelGuard extends SentinelGuard {
    constructor(reflector: Reflector) {
      super(reflector, strategyRegistry, config);
    }
  }

  return ConfiguredSentinelGuard;
}