import { IPValidator, APIKeyValidator, validateEnvironment } from "./utils";

describe("IPValidator", () => {
  describe("isValidIP", () => {
    it("should validate IPv4 addresses", () => {
      expect(IPValidator.isValidIP("192.168.1.1")).toBe(true);
      expect(IPValidator.isValidIP("127.0.0.1")).toBe(true);
      expect(IPValidator.isValidIP("255.255.255.255")).toBe(true);
      expect(IPValidator.isValidIP("0.0.0.0")).toBe(true);
    });

    it("should validate IPv6 addresses", () => {
      expect(IPValidator.isValidIP("::1")).toBe(true);
      expect(IPValidator.isValidIP("2001:db8::1")).toBe(true);
      expect(IPValidator.isValidIP("fe80::1")).toBe(true);
    });

    it("should reject invalid IP addresses", () => {
      expect(IPValidator.isValidIP("invalid")).toBe(false);
      expect(IPValidator.isValidIP("256.256.256.256")).toBe(false);
      expect(IPValidator.isValidIP("192.168.1")).toBe(false);
      expect(IPValidator.isValidIP("")).toBe(false);
    });
  });

  describe("isIPv4", () => {
    it("should identify IPv4 addresses", () => {
      expect(IPValidator.isIPv4("192.168.1.1")).toBe(true);
      expect(IPValidator.isIPv4("127.0.0.1")).toBe(true);
    });

    it("should reject IPv6 addresses", () => {
      expect(IPValidator.isIPv4("::1")).toBe(false);
      expect(IPValidator.isIPv4("2001:db8::1")).toBe(false);
    });
  });

  describe("isIPv6", () => {
    it("should identify IPv6 addresses", () => {
      expect(IPValidator.isIPv6("::1")).toBe(true);
      expect(IPValidator.isIPv6("2001:db8::1")).toBe(true);
    });

    it("should reject IPv4 addresses", () => {
      expect(IPValidator.isIPv6("192.168.1.1")).toBe(false);
      expect(IPValidator.isIPv6("127.0.0.1")).toBe(false);
    });
  });

  describe("isPrivateIP", () => {
    it("should identify private IPv4 addresses", () => {
      expect(IPValidator.isPrivateIP("192.168.1.1")).toBe(true);
      expect(IPValidator.isPrivateIP("10.0.0.1")).toBe(true);
      expect(IPValidator.isPrivateIP("172.16.0.1")).toBe(true);
    });

    it("should reject public IPv4 addresses", () => {
      expect(IPValidator.isPrivateIP("8.8.8.8")).toBe(false);
      expect(IPValidator.isPrivateIP("1.1.1.1")).toBe(false);
    });
  });

  describe("isLoopbackIP", () => {
    it("should identify loopback addresses", () => {
      expect(IPValidator.isLoopbackIP("127.0.0.1")).toBe(true);
      expect(IPValidator.isLoopbackIP("::1")).toBe(true);
    });

    it("should reject non-loopback addresses", () => {
      expect(IPValidator.isLoopbackIP("192.168.1.1")).toBe(false);
      expect(IPValidator.isLoopbackIP("8.8.8.8")).toBe(false);
    });
  });

  describe("isIPInRange", () => {
    it("should validate IP addresses in CIDR ranges", () => {
      expect(IPValidator.isIPInRange("192.168.1.10", "192.168.1.0/24")).toBe(
        true
      );
      expect(IPValidator.isIPInRange("10.0.0.50", "10.0.0.0/8")).toBe(true);
      expect(IPValidator.isIPInRange("172.16.5.10", "172.16.0.0/12")).toBe(
        true
      );
    });

    it("should reject IP addresses outside CIDR ranges", () => {
      expect(IPValidator.isIPInRange("192.168.2.10", "192.168.1.0/24")).toBe(
        false
      );
      expect(IPValidator.isIPInRange("11.0.0.50", "10.0.0.0/8")).toBe(false);
    });

    it("should handle exact IP matches", () => {
      expect(IPValidator.isIPInRange("192.168.1.1", "192.168.1.1")).toBe(true);
      expect(IPValidator.isIPInRange("192.168.1.2", "192.168.1.1")).toBe(false);
    });
  });

  describe("matchesPatterns", () => {
    it("should match against multiple patterns", () => {
      const patterns = ["192.168.1.0/24", "10.0.0.1", "172.16.0.0/12"];

      expect(IPValidator.matchesPatterns("192.168.1.10", patterns)).toBe(true);
      expect(IPValidator.matchesPatterns("10.0.0.1", patterns)).toBe(true);
      expect(IPValidator.matchesPatterns("172.16.5.10", patterns)).toBe(true);
      expect(IPValidator.matchesPatterns("8.8.8.8", patterns)).toBe(false);
    });
  });

  describe("validateIP", () => {
    it("should allow IP when whitelist matches", () => {
      const result = IPValidator.validateIP("192.168.1.10", {
        whitelist: ["192.168.1.0/24"],
      });
      expect(result.allowed).toBe(true);
    });

    it("should deny IP when blacklist matches", () => {
      const result = IPValidator.validateIP("192.168.1.10", {
        blacklist: ["192.168.1.0/24"],
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blacklisted");
    });

    it("should deny private IPs when not allowed", () => {
      const result = IPValidator.validateIP("192.168.1.10", {
        allowPrivate: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Private IP");
    });

    it("should deny loopback IPs when not allowed", () => {
      const result = IPValidator.validateIP("127.0.0.1", {
        allowLoopback: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Loopback IP");
    });

    it("should deny when IP not in whitelist", () => {
      const result = IPValidator.validateIP("8.8.8.8", {
        whitelist: ["192.168.1.0/24"],
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not in whitelist");
    });
  });

  describe("extractClientIP", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const headers = { "x-forwarded-for": "192.168.1.10, 10.0.0.1" };
      expect(IPValidator.extractClientIP(headers)).toBe("192.168.1.10");
    });

    it("should extract IP from x-real-ip header", () => {
      const headers = { "x-real-ip": "192.168.1.10" };
      expect(IPValidator.extractClientIP(headers)).toBe("192.168.1.10");
    });

    it("should fallback to remote address", () => {
      const headers = { "x-remote-addr": "192.168.1.10" };
      expect(IPValidator.extractClientIP(headers)).toBe("192.168.1.10");
    });

    it("should default to localhost when no IP found", () => {
      const headers = {};
      expect(IPValidator.extractClientIP(headers)).toBe("127.0.0.1");
    });
  });
});

describe("APIKeyValidator", () => {
  describe("extractAPIKey", () => {
    it("should extract API key from default header", () => {
      const headers = { "x-api-key": "test-key-123" };
      const query = {};
      expect(APIKeyValidator.extractAPIKey(headers, query)).toBe(
        "test-key-123"
      );
    });

    it("should extract API key from custom header", () => {
      const headers = { authorization: "Bearer test-key-123" };
      const query = {};
      expect(
        APIKeyValidator.extractAPIKey(headers, query, {
          header: "authorization",
        })
      ).toBe("Bearer test-key-123");
    });

    it("should extract API key from query parameter", () => {
      const headers = {};
      const query = { apiKey: "test-key-123" };
      expect(APIKeyValidator.extractAPIKey(headers, query)).toBe(
        "test-key-123"
      );
    });

    it("should extract API key from custom query parameter", () => {
      const headers = {};
      const query = { token: "test-key-123" };
      expect(
        APIKeyValidator.extractAPIKey(headers, query, { query: "token" })
      ).toBe("test-key-123");
    });

    it("should prefer header over query", () => {
      const headers = { "x-api-key": "header-key" };
      const query = { apiKey: "query-key" };
      expect(APIKeyValidator.extractAPIKey(headers, query)).toBe("header-key");
    });

    it("should return null when no API key found", () => {
      const headers = {};
      const query = {};
      expect(APIKeyValidator.extractAPIKey(headers, query)).toBeNull();
    });
  });

  describe("isValidFormat", () => {
    it("should validate correct API key formats", () => {
      expect(APIKeyValidator.isValidFormat("test-key-123")).toBe(true);
      expect(APIKeyValidator.isValidFormat("abcdef1234567890")).toBe(true);
      expect(APIKeyValidator.isValidFormat("key_with_underscores")).toBe(true);
      expect(APIKeyValidator.isValidFormat("key.with.dots")).toBe(true);
    });

    it("should reject invalid API key formats", () => {
      expect(APIKeyValidator.isValidFormat("")).toBe(false);
      expect(APIKeyValidator.isValidFormat("short")).toBe(false);
      expect(APIKeyValidator.isValidFormat("key with spaces")).toBe(false);
      expect(APIKeyValidator.isValidFormat("key@with#special")).toBe(false);
    });

    it("should reject keys that are too long", () => {
      const longKey = "a".repeat(300);
      expect(APIKeyValidator.isValidFormat(longKey)).toBe(false);
    });
  });

  describe("isExpired", () => {
    it("should return false for metadata without expiration", () => {
      const metadata = { name: "test-key" };
      expect(APIKeyValidator.isExpired(metadata)).toBe(false);
    });

    it("should return false for non-expired keys", () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const metadata = { expiresAt: futureDate.toISOString() };
      expect(APIKeyValidator.isExpired(metadata)).toBe(false);
    });

    it("should return true for expired keys", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const metadata = { expiresAt: pastDate.toISOString() };
      expect(APIKeyValidator.isExpired(metadata)).toBe(true);
    });
  });

  describe("validateWithMetadata", () => {
    it("should return invalid when metadata is null", () => {
      const result = APIKeyValidator.validateWithMetadata("test-key", null);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("API key not found");
    });

    it("should return invalid when key is disabled", () => {
      const metadata = { disabled: true };
      const result = APIKeyValidator.validateWithMetadata("test-key", metadata);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("API key is disabled");
    });

    it("should return invalid when key is expired", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const metadata = { expiresAt: pastDate.toISOString() };
      const result = APIKeyValidator.validateWithMetadata("test-key", metadata);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("API key has expired");
    });

    it("should return invalid when rate limit exceeded", () => {
      const metadata = { maxRequests: 100, currentRequests: 100 };
      const result = APIKeyValidator.validateWithMetadata("test-key", metadata);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("API key rate limit exceeded");
    });

    it("should return valid for valid metadata", () => {
      const metadata = {
        name: "test-key",
        maxRequests: 100,
        currentRequests: 50,
      };
      const result = APIKeyValidator.validateWithMetadata("test-key", metadata);
      expect(result.valid).toBe(true);
    });
  });
});

describe("validateEnvironment", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should validate with default values", () => {
    delete process.env.SENTINEL_ENABLED;
    delete process.env.SENTINEL_DEFAULT_STRATEGY;

    const config = validateEnvironment();
    expect(config.enabled).toBe(true);
    expect(config.defaultStrategy).toBe("default");
    expect(config.logLevel).toBe("info");
  });

  it("should parse environment variables correctly", () => {
    process.env.SENTINEL_ENABLED = "false";
    process.env.SENTINEL_DEFAULT_STRATEGY = "custom";
    process.env.SENTINEL_LOG_LEVEL = "debug";

    const config = validateEnvironment();
    expect(config.enabled).toBe(false);
    expect(config.defaultStrategy).toBe("custom");
    expect(config.logLevel).toBe("debug");
  });

  it("should convert string numbers to integers", () => {
    process.env.SENTINEL_RATE_LIMIT_WINDOW = "7200";
    process.env.SENTINEL_RATE_LIMIT_MAX = "500";

    const config = validateEnvironment();
    expect(config.rateLimitWindow).toBe(7200);
    expect(config.rateLimitMax).toBe(500);
  });
});
