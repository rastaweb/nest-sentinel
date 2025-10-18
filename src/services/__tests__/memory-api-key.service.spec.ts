import { Test, TestingModule } from "@nestjs/testing";
import { MemoryApiKeyService } from "../memory-api-key.service";
import { SENTINEL_OPTIONS } from "../../interfaces";

describe("MemoryApiKeyService", () => {
  let service: MemoryApiKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryApiKeyService,
        {
          provide: SENTINEL_OPTIONS,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MemoryApiKeyService>(MemoryApiKeyService);
  });

  describe("createKey", () => {
    it("should create an API key successfully", async () => {
      const result = await service.createKey(
        "service",
        "test-service",
        ["read", "write"],
        "Test Key"
      );

      expect(result).toHaveProperty("apiKey");
      expect(result).toHaveProperty("rawKey");
      expect(result.apiKey.name).toBe("Test Key");
      expect(result.apiKey.ownerType).toBe("service");
      expect(result.apiKey.ownerId).toBe("test-service");
      expect(result.apiKey.scopes).toEqual(["read", "write"]);
      expect(result.rawKey).toMatch(/^ak_[a-f0-9]+$/);
    });
  });

  describe("validateKey", () => {
    it("should validate a correct API key", async () => {
      const created = await service.createKey("service", "test-service", [
        "read",
        "write",
      ]);

      const result = await service.validateKey(created.rawKey);

      expect(result.valid).toBe(true);
      expect(result.apiKeyRecord).toBeDefined();
      expect(result.apiKeyRecord!.scopes).toEqual(["read", "write"]);
    });

    it("should fail validation for invalid API key", async () => {
      const result = await service.validateKey("invalid-key");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });

    it("should validate scopes correctly", async () => {
      const created = await service.createKey("service", "test-service", [
        "read",
      ]);

      const validResult = await service.validateKey(created.rawKey, ["read"]);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateKey(created.rawKey, [
        "write",
      ]);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain("Missing required scopes");
    });
  });

  describe("invalidateKey", () => {
    it("should invalidate an existing key", async () => {
      const created = await service.createKey("service", "test-service", []);

      const success = await service.invalidateKey(created.apiKey.id);
      expect(success).toBe(true);

      const validation = await service.validateKey(created.rawKey);
      expect(validation.valid).toBe(false);
    });

    it("should return false for non-existent key", async () => {
      const success = await service.invalidateKey("non-existent-id");
      expect(success).toBe(false);
    });
  });

  describe("listByOwner", () => {
    it("should list keys for a specific owner", async () => {
      await service.createKey("service", "test-service-1", ["read"]);
      await service.createKey("service", "test-service-1", ["write"]);
      await service.createKey("service", "test-service-2", ["admin"]);

      const keys = await service.listByOwner("service", "test-service-1");

      expect(keys).toHaveLength(2);
      expect(keys.every((key) => key.ownerId === "test-service-1")).toBe(true);
    });
  });

  describe("clearAll", () => {
    it("should clear all keys", async () => {
      await service.createKey("service", "test-service", ["read"]);

      let keys = service.getAllKeys();
      expect(keys).toHaveLength(1);

      service.clearAll();

      keys = service.getAllKeys();
      expect(keys).toHaveLength(0);
    });
  });
});
