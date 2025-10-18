import { DynamicModule, Module, Global } from "@nestjs/common";
import { MemoryApiKeyService } from "./services/memory-api-key.service";
import { MemoryLoggingService } from "./services/memory-logging.service";
import { AccessGuard } from "./guards/access.guard";
import { TrackTrafficInterceptor } from "./interceptors/track-traffic.interceptor";
import type { SentinelOptions } from "./interfaces";
import { DEFAULT_OPTIONS, SENTINEL_OPTIONS } from "./interfaces";

@Global()
@Module({})
export class SentinelModule {
  static register(options: SentinelOptions = {}): DynamicModule {
    // Validate configuration
    if (options.apiKeyHeader && options.apiKeyHeader.trim() === "") {
      throw new Error("apiKeyHeader cannot be empty");
    }

    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    return {
      module: SentinelModule,
      providers: [
        {
          provide: SENTINEL_OPTIONS,
          useValue: mergedOptions,
        },
        MemoryApiKeyService,
        MemoryLoggingService,
        AccessGuard,
        TrackTrafficInterceptor,
      ],
      exports: [
        MemoryApiKeyService,
        MemoryLoggingService,
        AccessGuard,
        TrackTrafficInterceptor,
        SENTINEL_OPTIONS,
      ],
      global: true,
    };
  }
  /**
   * Register for async configuration with validation
   */
  static registerAsync(options: {
    useFactory: (...args: any[]) => Promise<SentinelOptions> | SentinelOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: SentinelModule,
      providers: [
        {
          provide: SENTINEL_OPTIONS,
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);

            // Validate async configuration
            if (config.apiKeyHeader && config.apiKeyHeader.trim() === "") {
              throw new Error("apiKeyHeader cannot be empty");
            }

            return { ...DEFAULT_OPTIONS, ...config };
          },
          inject: options.inject || [],
        },
        MemoryApiKeyService,
        MemoryLoggingService,
        AccessGuard,
        TrackTrafficInterceptor,
      ],
      exports: [
        MemoryApiKeyService,
        MemoryLoggingService,
        AccessGuard,
        TrackTrafficInterceptor,
        SENTINEL_OPTIONS,
      ],
      global: true,
    };
  }
}
