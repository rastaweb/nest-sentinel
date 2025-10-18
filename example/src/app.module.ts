import { Module } from "@nestjs/common";
import {
  SentinelModule,
  createProductionConfig,
} from "@rastaweb/nest-sentinel";
import { PublicController } from "./controllers/public.controller";
import { ProtectedController } from "./controllers/protected.controller";
import { AdminController } from "./controllers/admin.controller";
import { CustomStrategyController } from "./controllers/custom-strategy.controller";
import { DatabaseController } from "./controllers/database.controller";
import { CustomSentinelStore } from "./services/custom-store.service";
import { CustomStrategy } from "./services/custom-strategy.service";
import { DatabaseService } from "./services/database.service";

@Module({
  imports: [
    // Basic configuration - global guard enabled
    SentinelModule.forRoot(
      createProductionConfig({
        // Allow private networks in development
        defaultIPRules: {
          type: "ip",
          allowPrivate: true,
          allowLoopback: true,
        },
        // API keys are required by default
        defaultAPIKeyRules: {
          type: "apiKey",
          required: false, // Make optional for demo purposes
          validateKey: true,
        },
      })
    ),

    // Alternative: Custom store example
    // SentinelModule.withStore(CustomSentinelStore, {
    //   defaultStrategy: 'custom'
    // }),

    // Alternative: Custom strategies example
    // SentinelModule.withStrategies([CustomStrategy], {
    //   defaultStrategy: 'custom'
    // })
  ],
  controllers: [
    PublicController,
    ProtectedController,
    AdminController,
    CustomStrategyController,
    DatabaseController,
  ],
  providers: [DatabaseService, CustomSentinelStore, CustomStrategy],
})
export class AppModule {}
