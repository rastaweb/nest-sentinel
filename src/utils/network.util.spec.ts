import {
  matchIpOrRange,
  matchMac,
  normalizeMac,
  parseClientIp,
} from "../utils/network.util";
import { Request } from "express";

describe("Network Utils", () => {
  describe("matchIpOrRange", () => {
    it("should match exact IP addresses", () => {
      expect(matchIpOrRange("192.168.1.1", "192.168.1.1")).toBe(true);
      expect(matchIpOrRange("192.168.1.1", "192.168.1.2")).toBe(false);
    });

    it("should match any pattern", () => {
      expect(matchIpOrRange("192.168.1.1", "any")).toBe(true);
      expect(matchIpOrRange("10.0.0.1", "*")).toBe(true);
    });

    it("should match IPv4 CIDR ranges", () => {
      expect(matchIpOrRange("192.168.1.1", "192.168.1.0/24")).toBe(true);
      expect(matchIpOrRange("192.168.2.1", "192.168.1.0/24")).toBe(false);
      expect(matchIpOrRange("10.0.0.1", "10.0.0.0/8")).toBe(true);
    });

    it("should handle invalid inputs gracefully", () => {
      expect(matchIpOrRange("invalid-ip", "192.168.1.0/24")).toBe(false);
      expect(matchIpOrRange("192.168.1.1", "invalid-range")).toBe(false);
    });
  });

  describe("normalizeMac", () => {
    it("should normalize MAC addresses to consistent format", () => {
      expect(normalizeMac("00:14:22:01:23:45")).toBe("00-14-22-01-23-45");
      expect(normalizeMac("00.14.22.01.23.45")).toBe("00-14-22-01-23-45");
      expect(normalizeMac("MAC:00:14:22:01:23:45")).toBe("00-14-22-01-23-45");
    });

    it("should handle empty input", () => {
      expect(normalizeMac("")).toBe("");
    });
  });

  describe("matchMac", () => {
    it("should match identical MAC addresses", () => {
      expect(matchMac("00:14:22:01:23:45", "00-14-22-01-23-45")).toBe(true);
      expect(matchMac("00.14.22.01.23.45", "00:14:22:01:23:45")).toBe(true);
    });

    it("should not match different MAC addresses", () => {
      expect(matchMac("00:14:22:01:23:45", "00:14:22:01:23:46")).toBe(false);
    });

    it("should handle empty inputs", () => {
      expect(matchMac("", "00:14:22:01:23:45")).toBe(false);
      expect(matchMac("00:14:22:01:23:45", "")).toBe(false);
    });
  });

  describe("parseClientIp", () => {
    it("should parse IP from request object", () => {
      const req = {
        ip: "192.168.1.1",
        headers: {},
        connection: { remoteAddress: "192.168.1.1" },
      } as unknown as Request;

      const result = parseClientIp(req, false);
      expect(result.ip).toBe("192.168.1.1");
      expect(result.ipVersion).toBe("ipv4");
    });

    it("should handle X-Forwarded-For header when trusting proxy", () => {
      const req = {
        ip: "127.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.1, 192.168.1.1" },
        connection: { remoteAddress: "127.0.0.1" },
      } as unknown as Request;

      const result = parseClientIp(req, true);
      expect(result.ip).toBe("203.0.113.1");
      expect(result.ipVersion).toBe("ipv4");
    });

    it("should ignore proxy headers when not trusting proxy", () => {
      const req = {
        ip: "127.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.1" },
        connection: { remoteAddress: "127.0.0.1" },
      } as unknown as Request;

      const result = parseClientIp(req, false);
      expect(result.ip).toBe("127.0.0.1");
    });

    it("should handle IPv6 addresses", () => {
      const req = {
        ip: "2001:db8::1",
        headers: {},
        connection: { remoteAddress: "2001:db8::1" },
      } as unknown as Request;

      const result = parseClientIp(req, false);
      expect(result.ip).toBe("2001:db8::1");
      expect(result.ipVersion).toBe("ipv6");
    });
  });
});
