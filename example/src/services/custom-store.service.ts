import { Injectable } from '@nestjs/common';
import { SentinelStore } from '@rastaweb/nest-sentinel';

/**
 * Custom Sentinel Store implementation that could integrate with a database
 * This example uses in-memory storage but shows the pattern for extending
 */
@Injectable()
export class CustomSentinelStore extends SentinelStore {
  private whitelistedIPs = new Set<string>(['127.0.0.1', '192.168.0.0/16']);
  private blacklistedIPs = new Set<string>();
  private apiKeys = new Map<string, Record<string, any>>();

  constructor() {
    super();
    // Initialize with some demo data
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Add some demo API keys
    this.apiKeys.set('demo-key-123', {
      name: 'Demo Key',
      permissions: ['read'],
      maxRequests: 1000,
      currentRequests: 50,
      createdAt: new Date().toISOString()
    });

    this.apiKeys.set('admin-key-456', {
      name: 'Admin Key',
      permissions: ['read', 'write', 'admin'],
      maxRequests: 10000,
      currentRequests: 100,
      createdAt: new Date().toISOString()
    });

    this.apiKeys.set('premium-key-789', {
      name: 'Premium Key',
      permissions: ['read', 'write'],
      maxRequests: 5000,
      currentRequests: 250,
      tier: 'premium',
      createdAt: new Date().toISOString()
    });

    // Add some demo whitelisted IPs
    this.whitelistedIPs.add('192.168.1.100');
    this.whitelistedIPs.add('10.0.0.50');
  }

  async isIPAllowed(ip: string): Promise<boolean> {
    // In a real implementation, this would query a database
    return this.whitelistedIPs.has(ip) || this.isIPInWhitelistedRanges(ip);
  }

  async isIPBlacklisted(ip: string): Promise<boolean> {
    // Check blacklist
    return this.blacklistedIPs.has(ip);
  }

  async isAPIKeyValid(key: string): Promise<boolean> {
    // In a real implementation, this would query a database
    return this.apiKeys.has(key);
  }

  async getAPIKeyMetadata(key: string): Promise<Record<string, any> | null> {
    // In a real implementation, this would query a database
    const metadata = this.apiKeys.get(key);
    if (!metadata) return null;

    // Simulate rate limiting check
    if (metadata.currentRequests >= metadata.maxRequests) {
      return { ...metadata, rateLimited: true };
    }

    return metadata;
  }

  async addIPToWhitelist(ip: string): Promise<void> {
    // In a real implementation, this would insert into a database
    this.whitelistedIPs.add(ip);
    console.log(`Added IP to whitelist: ${ip}`);
  }

  async addIPToBlacklist(ip: string): Promise<void> {
    // In a real implementation, this would insert into a database
    this.blacklistedIPs.add(ip);
    console.log(`Added IP to blacklist: ${ip}`);
  }

  async removeIPFromWhitelist(ip: string): Promise<void> {
    // In a real implementation, this would delete from a database
    this.whitelistedIPs.delete(ip);
    console.log(`Removed IP from whitelist: ${ip}`);
  }

  async removeIPFromBlacklist(ip: string): Promise<void> {
    // In a real implementation, this would delete from a database
    this.blacklistedIPs.delete(ip);
    console.log(`Removed IP from blacklist: ${ip}`);
  }

  /**
   * Custom method: Check if IP is in any whitelisted CIDR ranges
   */
  private isIPInWhitelistedRanges(ip: string): boolean {
    // This is a simplified implementation
    // In a real app, you'd use proper CIDR matching
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('10.')) return true;
    if (ip === '127.0.0.1') return true;
    return false;
  }

  /**
   * Custom method: Increment API key usage
   */
  async incrementAPIKeyUsage(key: string): Promise<void> {
    const metadata = this.apiKeys.get(key);
    if (metadata) {
      metadata.currentRequests = (metadata.currentRequests || 0) + 1;
      metadata.lastUsed = new Date().toISOString();
    }
  }

  /**
   * Custom method: Get API key statistics
   */
  async getAPIKeyStats(key: string): Promise<Record<string, any> | null> {
    const metadata = this.apiKeys.get(key);
    if (!metadata) return null;

    return {
      name: metadata.name,
      permissions: metadata.permissions,
      usage: {
        current: metadata.currentRequests,
        limit: metadata.maxRequests,
        percentage: (metadata.currentRequests / metadata.maxRequests) * 100
      },
      tier: metadata.tier || 'standard',
      lastUsed: metadata.lastUsed,
      createdAt: metadata.createdAt
    };
  }

  /**
   * Custom method: List all API keys (for admin purposes)
   */
  async listAllAPIKeys(): Promise<Array<{ key: string; metadata: Record<string, any> }>> {
    return Array.from(this.apiKeys.entries()).map(([key, metadata]) => ({
      key: `${key.substring(0, 8)}...`, // Partial key for security
      metadata: {
        name: metadata.name,
        permissions: metadata.permissions,
        tier: metadata.tier || 'standard',
        usage: {
          current: metadata.currentRequests,
          limit: metadata.maxRequests
        },
        createdAt: metadata.createdAt
      }
    }));
  }
}