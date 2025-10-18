/**
 * Simple test script to verify dependency injection is working
 */
import { Test, TestingModule } from "@nestjs/testing";
import { SentinelModule } from "./src/module";
import { DefaultSentinelStrategy } from "./src/strategies";
import { SENTINEL_STORE_TOKEN } from "./src/constants";

async function testDependencyInjection() {
  try {
    console.log("Testing dependency injection...");

    // Create a test module
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        SentinelModule.forRoot({
          enabled: true,
          defaultStrategy: "default",
          envValidation: false,
        }),
      ],
    }).compile();

    // Try to get the DefaultSentinelStrategy
    const strategy = module.get<DefaultSentinelStrategy>(
      DefaultSentinelStrategy
    );
    console.log("✅ DefaultSentinelStrategy resolved successfully");
    console.log("Strategy name:", strategy.name);

    // Try to get the store
    const store = module.get(SENTINEL_STORE_TOKEN);
    console.log("✅ SentinelStore resolved successfully");
    console.log("Store type:", store.constructor.name);

    // Test that strategy can validate
    const result = await strategy.validate({
      clientIP: "127.0.0.1",
      headers: {},
      query: {},
      routeOptions: { skip: true },
    });
    console.log("✅ Strategy validation works:", result);

    await module.close();
    console.log("✅ Dependency injection test passed!");
  } catch (error) {
    console.error("❌ Dependency injection test failed:", error);
    process.exit(1);
  }
}

testDependencyInjection();
