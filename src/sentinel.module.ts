import { DynamicModule, Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKey, TrafficLog, AccessEvent } from "./entities";
import { ApiKeyService } from "./services/api-key.service";
import { TrafficService } from "./services/traffic.service";
import { AccessGuard } from "./guards/access.guard";
import { TrackTrafficInterceptor } from "./interceptors/track-traffic.interceptor";
import {
  SentinelOptions,
  DEFAULT_OPTIONS,
  SENTINEL_OPTIONS,
} from "./interfaces";

@Global()
@Module({})
export class SentinelModule {
  static register(options: SentinelOptions = {}): DynamicModule {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    // Determine database configuration
    const dbConfig = this.getDatabaseConfig(mergedOptions);

    return {
      module: SentinelModule,
      imports: [
        TypeOrmModule.forRoot({
          ...dbConfig,
          entities: [ApiKey, TrafficLog, AccessEvent],
          synchronize: mergedOptions.autoMigrate || false,
          logging: mergedOptions.enableLogs ? ["error", "warn"] : false,
        }),
        TypeOrmModule.forFeature([ApiKey, TrafficLog, AccessEvent]),
      ],
      providers: [
        {
          provide: SENTINEL_OPTIONS,
          useValue: mergedOptions,
        },
        ApiKeyService,
        TrafficService,
        AccessGuard,
        TrackTrafficInterceptor,
      ],
      exports: [
        ApiKeyService,
        TrafficService,
        AccessGuard,
        TrackTrafficInterceptor,
        SENTINEL_OPTIONS,
      ],
      global: true,
    };
  }

  /**
   * Get database configuration based on options
   */
  private static getDatabaseConfig(options: SentinelOptions) {
    if (options.dbUrl) {
      // Parse database URL
      if (options.dbUrl.startsWith("mysql://")) {
        return {
          type: "mysql" as const,
          url: options.dbUrl,
        };
      } else if (options.dbUrl.startsWith("postgres://")) {
        return {
          type: "postgres" as const,
          url: options.dbUrl,
        };
      } else if (
        options.dbUrl.includes(".db") ||
        options.dbUrl.includes("sqlite")
      ) {
        return {
          type: "sqlite" as const,
          database: options.dbUrl,
        };
      }
    }

    // Default to SQLite for development
    return {
      type: "sqlite" as const,
      database: ":memory:", // In-memory database for development
    };
  }

  /**
   * Register for async configuration
   */
  static registerAsync(options: {
    useFactory: (...args: any[]) => Promise<SentinelOptions> | SentinelOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: SentinelModule,
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            const mergedOptions = { ...DEFAULT_OPTIONS, ...config };
            const dbConfig = this.getDatabaseConfig(mergedOptions);

            return {
              ...dbConfig,
              entities: [ApiKey, TrafficLog, AccessEvent],
              synchronize: mergedOptions.autoMigrate || false,
              logging: mergedOptions.enableLogs ? ["error", "warn"] : false,
            };
          },
          inject: options.inject || [],
        }),
        TypeOrmModule.forFeature([ApiKey, TrafficLog, AccessEvent]),
      ],
      providers: [
        {
          provide: SENTINEL_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        ApiKeyService,
        TrafficService,
        AccessGuard,
        TrackTrafficInterceptor,
      ],
      exports: [
        ApiKeyService,
        TrafficService,
        AccessGuard,
        TrackTrafficInterceptor,
        SENTINEL_OPTIONS,
      ],
      global: true,
    };
  }
}
