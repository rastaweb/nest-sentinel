import { Test, TestingModule } from "@nestjs/testing";
import {
  InMemorySentinelStore,
  DefaultSentinelStrategy,
  AllowAllStrategy,
  DenyAllStrategy,
  IPOnlyStrategy,
  StrategyRegistry,
} from "./strategies";
import { ValidationContext } from "./interfaces";

describe("InMemorySentinelStore", () => {
  let store: InMemorySentinelStore;

  beforeEach(() => {
    store = new InMemorySentinelStore();
  });

  afterEach(async () => {
    await store.clear();
  });

  describe("IP Management", () => {
    it("should add and check IP in whitelist", async () => {
      await store.addIPToWhitelist("192.168.1.1");
      expect(await store.isIPAllowed("192.168.1.1")).toBe(true);
      expect(await store.isIPAllowed("192.168.1.2")).toBe(false);
    });

    it("should add and check IP in blacklist", async () => {
      await store.addIPToBlacklist("192.168.1.1");
      expect(await store.isIPBlacklisted("192.168.1.1")).toBe(true);
      expect(await store.isIPBlacklisted("192.168.1.2")).toBe(false);
    });

    it("should remove IP from whitelist", async () => {
      await store.addIPToWhitelist("192.168.1.1");
      expect(await store.isIPAllowed("192.168.1.1")).toBe(true);

      await store.removeIPFromWhitelist("192.168.1.1");
      expect(await store.isIPAllowed("192.168.1.1")).toBe(false);
    });

    it("should remove IP from blacklist", async () => {
      await store.addIPToBlacklist("192.168.1.1");
      expect(await store.isIPBlacklisted("192.168.1.1")).toBe(true);

      await store.removeIPFromBlacklist("192.168.1.1");
      expect(await store.isIPBlacklisted("192.168.1.1")).toBe(false);
    });
  });

  describe("API Key Management", () => {
    it("should add and validate API key", async () => {
      await store.addAPIKey("test-key", { name: "Test Key" });
      expect(await store.isAPIKeyValid("test-key")).toBe(true);
      expect(await store.isAPIKeyValid("invalid-key")).toBe(false);
    });

    it("should get API key metadata", async () => {
      const metadata = { name: "Test Key", maxRequests: 100 };
      await store.addAPIKey("test-key", metadata);

      const retrieved = await store.getAPIKeyMetadata("test-key");
      expect(retrieved?.name).toBe("Test Key");
      expect(retrieved?.maxRequests).toBe(100);
      expect(retrieved?.createdAt).toBeDefined();
    });

    it("should return null for non-existent API key metadata", async () => {
      const metadata = await store.getAPIKeyMetadata("non-existent");
      expect(metadata).toBeNull();
    });

    it("should update API key metadata", async () => {
      await store.addAPIKey("test-key", { name: "Original" });
      await store.updateAPIKeyMetadata("test-key", {
        name: "Updated",
        version: 2,
      });

      const metadata = await store.getAPIKeyMetadata("test-key");
      expect(metadata?.name).toBe("Updated");
      expect(metadata?.version).toBe(2);
    });

    it("should remove API key", async () => {
      await store.addAPIKey("test-key", { name: "Test Key" });
      expect(await store.isAPIKeyValid("test-key")).toBe(true);

      await store.removeAPIKey("test-key");
      expect(await store.isAPIKeyValid("test-key")).toBe(false);
    });

    it("should list all API keys", async () => {
      await store.addAPIKey("key1", { name: "Key 1" });
      await store.addAPIKey("key2", { name: "Key 2" });

      const keys = await store.listAPIKeys();
      expect(keys).toHaveLength(2);
      expect(keys.find((k) => k.key === "key1")?.metadata.name).toBe("Key 1");
      expect(keys.find((k) => k.key === "key2")?.metadata.name).toBe("Key 2");
    });
  });

  describe("Clear", () => {
    it("should clear all data", async () => {
      await store.addIPToWhitelist("192.168.1.1");
      await store.addIPToBlacklist("10.0.0.1");
      await store.addAPIKey("test-key", {});

      await store.clear();

      expect(await store.isIPAllowed("192.168.1.1")).toBe(false);
      expect(await store.isIPBlacklisted("10.0.0.1")).toBe(false);
      expect(await store.isAPIKeyValid("test-key")).toBe(false);
    });
  });
});

describe("DefaultSentinelStrategy", () => {
  let strategy: DefaultSentinelStrategy;
  let store: InMemorySentinelStore;

  beforeEach(() => {
    store = new InMemorySentinelStore();
    strategy = new DefaultSentinelStrategy(store);
  });

  const createValidationContext = (
    overrides: Partial<ValidationContext> = {}
  ): ValidationContext => ({
    clientIP: "192.168.1.1",
    apiKey: "test-key",
    headers: {},
    query: {},
    ...overrides,
  });

  describe("Basic Validation", () => {
    it("should allow access when skip is true", async () => {
      const context = createValidationContext({
        routeOptions: { skip: true },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });

    it("should allow access when no validation rules are configured", async () => {
      const context = createValidationContext();

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });
  });

  describe("IP Validation", () => {
    it("should allow IP in whitelist array", async () => {
      const context = createValidationContext({
        clientIP: "192.168.1.10",
        routeOptions: {
          ip: ["192.168.1.0/24"],
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });

    it("should deny IP not in whitelist array", async () => {
      const context = createValidationContext({
        clientIP: "10.0.0.10",
        routeOptions: {
          ip: ["192.168.1.0/24"],
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(false);
    });

    it("should deny blacklisted IP from store", async () => {
      await store.addIPToBlacklist("192.168.1.1");

      const context = createValidationContext({
        clientIP: "192.168.1.1",
        routeOptions: {
          ip: {
            type: "ip",
            whitelist: ["192.168.1.0/24"],
          },
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blacklisted");
    });

    it("should validate with detailed IP rules", async () => {
      const context = createValidationContext({
        clientIP: "192.168.1.10",
        routeOptions: {
          ip: {
            type: "ip",
            whitelist: ["192.168.1.0/24"],
            allowPrivate: true,
          },
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });
  });

  describe("API Key Validation", () => {
    it("should require API key when apiKey is true", async () => {
      const context = createValidationContext({
        apiKey: undefined,
        routeOptions: { apiKey: true },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("required");
    });

    it("should validate API key format and existence", async () => {
      await store.addAPIKey("valid-key", {});

      const context = createValidationContext({
        apiKey: "valid-key",
        routeOptions: { apiKey: true },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });

    it("should deny invalid API key", async () => {
      const context = createValidationContext({
        apiKey: "invalid-key",
        routeOptions: { apiKey: true },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Invalid API key");
    });

    it("should validate with detailed API key rules", async () => {
      await store.addAPIKey("test-key", {});

      const context = createValidationContext({
        apiKey: "test-key",
        routeOptions: {
          apiKey: {
            type: "apiKey",
            required: true,
            validateKey: true,
          },
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Combined Validation", () => {
    it("should validate both IP and API key", async () => {
      await store.addAPIKey("test-key", {});

      const context = createValidationContext({
        clientIP: "192.168.1.10",
        apiKey: "test-key",
        routeOptions: {
          ip: ["192.168.1.0/24"],
          apiKey: true,
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });

    it("should deny when IP is valid but API key is invalid", async () => {
      const context = createValidationContext({
        clientIP: "192.168.1.10",
        apiKey: "invalid-key",
        routeOptions: {
          ip: ["192.168.1.0/24"],
          apiKey: true,
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(false);
    });
  });

  describe("Custom Rules", () => {
    it("should process custom IP rules", async () => {
      const context = createValidationContext({
        clientIP: "192.168.1.10",
        routeOptions: {
          rules: [
            {
              type: "ip",
              whitelist: ["192.168.1.0/24"],
            },
          ],
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(true);
    });

    it("should deny unknown rule types", async () => {
      const context = createValidationContext({
        routeOptions: {
          rules: [
            {
              type: "apiKey",
            },
          ],
        },
      });

      const result = await strategy.validate(context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Unknown rule type");
    });
  });
});

describe("AllowAllStrategy", () => {
  let strategy: AllowAllStrategy;

  beforeEach(() => {
    strategy = new AllowAllStrategy();
  });

  it("should allow all requests", () => {
    const context: ValidationContext = {
      clientIP: "192.168.1.1",
      headers: {},
      query: {},
    };

    const result = strategy.validate(context);
    expect(result.allowed).toBe(true);
    expect(result.metadata?.strategy).toBe("allow-all");
  });
});

describe("DenyAllStrategy", () => {
  let strategy: DenyAllStrategy;

  beforeEach(() => {
    strategy = new DenyAllStrategy();
  });

  it("should deny all requests", () => {
    const context: ValidationContext = {
      clientIP: "192.168.1.1",
      headers: {},
      query: {},
    };

    const result = strategy.validate(context);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("deny-all");
  });
});

describe("IPOnlyStrategy", () => {
  let strategy: IPOnlyStrategy;
  let store: InMemorySentinelStore;

  beforeEach(() => {
    store = new InMemorySentinelStore();
    strategy = new IPOnlyStrategy(store);
  });

  const createValidationContext = (
    overrides: Partial<ValidationContext> = {}
  ): ValidationContext => ({
    clientIP: "192.168.1.1",
    headers: {},
    query: {},
    ...overrides,
  });

  it("should allow when skip is true", async () => {
    const context = createValidationContext({
      routeOptions: { skip: true },
    });

    const result = await strategy.validate(context);
    expect(result.allowed).toBe(true);
  });

  it("should deny blacklisted IP", async () => {
    await store.addIPToBlacklist("192.168.1.1");

    const context = createValidationContext({
      clientIP: "192.168.1.1",
    });

    const result = await strategy.validate(context);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blacklisted");
  });

  it("should validate against route IP configuration", async () => {
    const context = createValidationContext({
      clientIP: "192.168.1.10",
      routeOptions: {
        ip: ["192.168.1.0/24"],
      },
    });

    const result = await strategy.validate(context);
    expect(result.allowed).toBe(true);
  });

  it("should check store whitelist when no route configuration", async () => {
    await store.addIPToWhitelist("192.168.1.1");

    const context = createValidationContext({
      clientIP: "192.168.1.1",
    });

    const result = await strategy.validate(context);
    expect(result.allowed).toBe(true);
  });

  it("should deny IP not in store whitelist", async () => {
    const context = createValidationContext({
      clientIP: "192.168.1.1",
    });

    const result = await strategy.validate(context);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in whitelist");
  });
});

describe("StrategyRegistry", () => {
  let registry: StrategyRegistry;
  let mockStrategy: any;

  beforeEach(() => {
    registry = new StrategyRegistry();
    mockStrategy = {
      name: "test-strategy",
      validate: jest.fn().mockReturnValue({ allowed: true }),
    };
  });

  it("should register and retrieve strategies", () => {
    registry.register(mockStrategy);
    expect(registry.get("test-strategy")).toBe(mockStrategy);
  });

  it("should return undefined for non-existent strategy", () => {
    expect(registry.get("non-existent")).toBeUndefined();
  });

  it("should unregister strategies", () => {
    registry.register(mockStrategy);
    expect(registry.get("test-strategy")).toBe(mockStrategy);

    registry.unregister("test-strategy");
    expect(registry.get("test-strategy")).toBeUndefined();
  });

  it("should list all strategy names", () => {
    const strategy2 = { ...mockStrategy, name: "strategy2" };

    registry.register(mockStrategy);
    registry.register(strategy2);

    const names = registry.list();
    expect(names).toContain("test-strategy");
    expect(names).toContain("strategy2");
    expect(names).toHaveLength(2);
  });

  it("should clear all strategies", () => {
    registry.register(mockStrategy);
    expect(registry.list()).toHaveLength(1);

    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});
