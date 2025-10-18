import { Test, TestingModule } from "@nestjs/testing";
import { MemoryLoggingService } from "../memory-logging.service";
import { SENTINEL_OPTIONS } from "../../interfaces";

describe("MemoryLoggingService", () => {
  let service: MemoryLoggingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryLoggingService,
        {
          provide: SENTINEL_OPTIONS,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MemoryLoggingService>(MemoryLoggingService);
  });

  afterEach(() => {
    service.clearLogs();
  });

  describe("logTraffic", () => {
    it("should log traffic data", async () => {
      const logData = {
        method: "GET",
        path: "/api/test",
        statusCode: 200,
        durationMs: 150,
        ip: "192.168.1.100",
        ipVersion: "ipv4" as const,
        requestHeaders: { "user-agent": "test" },
      };

      await service.logTraffic(logData);

      const logs = service.getRecentTrafficLogs(10);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject(logData);
    });
  });

  describe("logAccessEvent", () => {
    it("should log access events", async () => {
      await service.logAccessEvent(
        "allow",
        "IP whitelisted",
        "192.168.1.100",
        undefined,
        "key-123"
      );

      const events = service.getRecentAccessEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        decision: "allow",
        reason: "IP whitelisted",
        ip: "192.168.1.100",
        apiKeyId: "key-123",
      });
    });
  });

  describe("getTrafficStats", () => {
    it("should calculate traffic statistics correctly", async () => {
      // Add some test traffic
      await service.logTraffic({
        method: "GET",
        path: "/api/users",
        statusCode: 200,
        durationMs: 100,
        ip: "192.168.1.100",
        ipVersion: "ipv4",
        requestHeaders: {},
      });

      await service.logTraffic({
        method: "POST",
        path: "/api/users",
        statusCode: 201,
        durationMs: 200,
        ip: "192.168.1.101",
        ipVersion: "ipv4",
        requestHeaders: {},
      });

      const stats = service.getTrafficStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.uniqueIps).toBe(2);
      expect(stats.averageResponseTime).toBe(150);
      expect(stats.statusCodeDistribution[200]).toBe(1);
      expect(stats.statusCodeDistribution[201]).toBe(1);
      expect(stats.topEndpoints).toContainEqual({
        path: "/api/users",
        count: 2,
      });
    });
  });

  describe("getAccessEventStats", () => {
    it("should calculate access event statistics correctly", async () => {
      await service.logAccessEvent("allow", "Valid API key", "192.168.1.100");
      await service.logAccessEvent("deny", "Invalid API key", "192.168.1.101");
      await service.logAccessEvent("deny", "IP not allowed", "192.168.1.102");
      await service.logAccessEvent("deny", "Invalid API key", "192.168.1.103");

      const stats = service.getAccessEventStats();

      expect(stats.totalEvents).toBe(4);
      expect(stats.allowedEvents).toBe(1);
      expect(stats.deniedEvents).toBe(3);
      expect(stats.topDeniedReasons).toContainEqual({
        reason: "Invalid API key",
        count: 2,
      });
    });
  });

  describe("memory management", () => {
    it("should limit memory usage by removing old entries", async () => {
      const service = new MemoryLoggingService({
        provide: SENTINEL_OPTIONS,
        useValue: {},
      } as any);

      // Override maxLogEntries for testing
      (service as any).maxLogEntries = 3;

      // Add more logs than the limit
      for (let i = 0; i < 5; i++) {
        await service.logTraffic({
          method: "GET",
          path: `/api/test${i}`,
          statusCode: 200,
          durationMs: 100,
          ip: "192.168.1.100",
          ipVersion: "ipv4",
          requestHeaders: {},
        });
      }

      const logs = service.getRecentTrafficLogs(10);
      expect(logs).toHaveLength(3);

      // Should have the most recent logs
      expect(logs[0].path).toBe("/api/test4");
      expect(logs[1].path).toBe("/api/test3");
      expect(logs[2].path).toBe("/api/test2");
    });
  });
});
