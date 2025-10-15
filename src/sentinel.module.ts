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

    return {
      module: SentinelModule,
      imports: [
        // Only register entities with existing TypeORM connection
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
   * Register for async configuration
   */
  static registerAsync(options: {
    useFactory: (...args: any[]) => Promise<SentinelOptions> | SentinelOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: SentinelModule,
      imports: [
        // Only register entities with existing TypeORM connection
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
