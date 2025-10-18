import { Module, DynamicModule, Provider, Global } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  SentinelConfig,
  SentinelAsyncOptions,
  SentinelOptionsFactory,
  SentinelStore,
  SentinelStrategy,
} from "./interfaces";
import {
  SENTINEL_CONFIG_TOKEN,
  SENTINEL_STORE_TOKEN,
  SENTINEL_STRATEGIES_TOKEN,
} from "./constants";
import { SentinelGuard } from "./guard";
import {
  InMemorySentinelStore,
  DefaultSentinelStrategy,
  AllowAllStrategy,
  DenyAllStrategy,
  IPOnlyStrategy,
  StrategyRegistry,
} from "./strategies";
import { validateEnvironment } from "./utils";

/**
 * Core Sentinel Module
 */
@Global()
@Module({})
export class SentinelModule {
  /**
   * Configure Sentinel module with synchronous configuration
   */
  static forRoot(config: SentinelConfig = {}): DynamicModule {
    const configProvider: Provider = {
      provide: SENTINEL_CONFIG_TOKEN,
      useValue: {
        enabled: true,
        defaultStrategy: "default",
        envValidation: true,
        ...config,
      },
    };

    const storeProvider: Provider = {
      provide: SENTINEL_STORE_TOKEN,
      useClass: InMemorySentinelStore,
    };

    return {
      module: SentinelModule,
      providers: [
        configProvider,
        storeProvider,
        ...this.createStrategyProviders(),
        ...this.createCoreProviders(true),
      ],
      exports: [
        SENTINEL_CONFIG_TOKEN,
        SENTINEL_STORE_TOKEN,
        StrategyRegistry,
        SentinelGuard,
      ],
    };
  }

  /**
   * Configure Sentinel module with asynchronous configuration
   */
  static forRootAsync(options: SentinelAsyncOptions): DynamicModule {
    const configProvider = this.createAsyncConfigProvider(options);

    const storeProvider: Provider = {
      provide: SENTINEL_STORE_TOKEN,
      useClass: InMemorySentinelStore,
    };

    return {
      module: SentinelModule,
      imports: options.imports || [],
      providers: [
        configProvider,
        storeProvider,
        ...this.createStrategyProviders(),
        ...this.createCoreProviders(true),
        ...(options.useClass ? [options.useClass] : []),
      ],
      exports: [
        SENTINEL_CONFIG_TOKEN,
        SENTINEL_STORE_TOKEN,
        StrategyRegistry,
        SentinelGuard,
      ],
    };
  }

  /**
   * Configure Sentinel module as a feature module (without global guard)
   */
  static forFeature(config: SentinelConfig = {}): DynamicModule {
    const configProvider: Provider = {
      provide: SENTINEL_CONFIG_TOKEN,
      useValue: {
        enabled: true,
        defaultStrategy: "default",
        ...config,
      },
    };

    const storeProvider: Provider = {
      provide: SENTINEL_STORE_TOKEN,
      useClass: InMemorySentinelStore,
    };

    return {
      module: SentinelModule,
      providers: [
        configProvider,
        storeProvider,
        ...this.createStrategyProviders(),
        ...this.createCoreProviders(false),
      ],
      exports: [
        SENTINEL_CONFIG_TOKEN,
        SENTINEL_STORE_TOKEN,
        StrategyRegistry,
        SentinelGuard,
      ],
    };
  }

  /**
   * Configure with custom store
   */
  static withStore<T extends SentinelStore>(
    storeClass: new (...args: any[]) => T,
    config: SentinelConfig = {}
  ): DynamicModule {
    const configProvider: Provider = {
      provide: SENTINEL_CONFIG_TOKEN,
      useValue: {
        enabled: true,
        defaultStrategy: "default",
        ...config,
      },
    };

    const storeProvider: Provider = {
      provide: SENTINEL_STORE_TOKEN,
      useClass: storeClass,
    };

    return {
      module: SentinelModule,
      providers: [
        configProvider,
        storeProvider,
        ...this.createStrategyProviders(),
        ...this.createCoreProviders(true),
      ],
      exports: [
        SENTINEL_CONFIG_TOKEN,
        SENTINEL_STORE_TOKEN,
        StrategyRegistry,
        SentinelGuard,
      ],
    };
  }

  /**
   * Configure with custom strategies
   */
  static withStrategies(
    strategies: (new (...args: any[]) => SentinelStrategy)[],
    config: SentinelConfig = {}
  ): DynamicModule {
    const configProvider: Provider = {
      provide: SENTINEL_CONFIG_TOKEN,
      useValue: {
        enabled: true,
        defaultStrategy: "default",
        ...config,
      },
    };

    const storeProvider: Provider = {
      provide: SENTINEL_STORE_TOKEN,
      useClass: InMemorySentinelStore,
    };

    const customStrategyProviders = strategies.map((StrategyClass) => ({
      provide: StrategyClass,
      useClass: StrategyClass,
    }));

    return {
      module: SentinelModule,
      providers: [
        configProvider,
        storeProvider,
        ...this.createStrategyProviders(),
        ...customStrategyProviders,
        ...this.createCoreProviders(true),
      ],
      exports: [
        SENTINEL_CONFIG_TOKEN,
        SENTINEL_STORE_TOKEN,
        StrategyRegistry,
        SentinelGuard,
        ...strategies,
      ],
    };
  }

  /**
   * Create async configuration provider
   */
  private static createAsyncConfigProvider(
    options: SentinelAsyncOptions
  ): Provider {
    if (options.useFactory) {
      return {
        provide: SENTINEL_CONFIG_TOKEN,
        useFactory: async (...args: any[]) => {
          const config = await options.useFactory!(...args);
          return {
            enabled: true,
            defaultStrategy: "default",
            envValidation: true,
            ...config,
          };
        },
        inject: options.inject || [],
      };
    }

    if (options.useClass) {
      return {
        provide: SENTINEL_CONFIG_TOKEN,
        useFactory: async (factory: SentinelOptionsFactory) => {
          const config = await factory.createSentinelOptions();
          return {
            enabled: true,
            defaultStrategy: "default",
            envValidation: true,
            ...config,
          };
        },
        inject: [options.useClass],
      };
    }

    if (options.useExisting) {
      return {
        provide: SENTINEL_CONFIG_TOKEN,
        useFactory: async (factory: SentinelOptionsFactory) => {
          const config = await factory.createSentinelOptions();
          return {
            enabled: true,
            defaultStrategy: "default",
            envValidation: true,
            ...config,
          };
        },
        inject: [options.useExisting],
      };
    }

    throw new Error("Invalid async configuration options");
  }

  /**
   * Create default strategy providers
   */
  private static createStrategyProviders(): Provider[] {
    return [
      // Provide the default store implementation
      {
        provide: SENTINEL_STORE_TOKEN,
        useClass: InMemorySentinelStore,
      },
      {
        provide: DefaultSentinelStrategy,
        useClass: DefaultSentinelStrategy,
      },
      {
        provide: AllowAllStrategy,
        useClass: AllowAllStrategy,
      },
      {
        provide: DenyAllStrategy,
        useClass: DenyAllStrategy,
      },
      {
        provide: IPOnlyStrategy,
        useClass: IPOnlyStrategy,
      },
    ];
  }

  /**
   * Create core providers (strategy registry, guard, etc.)
   */
  private static createCoreProviders(useGlobalGuard: boolean): Provider[] {
    const providers: Provider[] = [
      {
        provide: StrategyRegistry,
        useFactory: (
          defaultStrategy: DefaultSentinelStrategy,
          allowAllStrategy: AllowAllStrategy,
          denyAllStrategy: DenyAllStrategy,
          ipOnlyStrategy: IPOnlyStrategy
        ) => {
          const registry = new StrategyRegistry();

          // Register default strategies
          registry.register(defaultStrategy);
          registry.register(allowAllStrategy);
          registry.register(denyAllStrategy);
          registry.register(ipOnlyStrategy);

          return registry;
        },
        inject: [
          DefaultSentinelStrategy,
          AllowAllStrategy,
          DenyAllStrategy,
          IPOnlyStrategy,
        ],
      },
      {
        provide: SentinelGuard,
        useClass: SentinelGuard,
      },
    ];

    // Add global guard if requested
    if (useGlobalGuard) {
      providers.push({
        provide: APP_GUARD,
        useExisting: SentinelGuard,
      });
    }

    return providers;
  }

  /**
   * Module initialization
   */
  constructor() {
    // Validate environment variables if enabled
    try {
      validateEnvironment();
    } catch (error) {
      console.warn(`Sentinel environment validation warning: ${error}`);
    }
  }
}

/**
 * Utility function to create a minimal configuration
 */
export function createSentinelConfig(
  overrides: Partial<SentinelConfig> = {}
): SentinelConfig {
  return {
    enabled: true,
    defaultStrategy: "default",
    envValidation: true,
    ...overrides,
  };
}

/**
 * Factory for creating test configurations
 */
export function createTestConfig(): SentinelConfig {
  return {
    enabled: true,
    defaultStrategy: "allow-all",
    envValidation: false,
  };
}

/**
 * Factory for creating production configurations
 */
export function createProductionConfig(
  overrides: Partial<SentinelConfig> = {}
): SentinelConfig {
  return {
    enabled: true,
    defaultStrategy: "default",
    envValidation: true,
    defaultIPRules: {
      type: "ip",
      allowPrivate: false,
      allowLoopback: false,
    },
    defaultAPIKeyRules: {
      type: "apiKey",
      required: true,
      validateKey: true,
    },
    ...overrides,
  };
}
