import { Injectable } from '@nestjs/common';
import { SentinelStrategy, ValidationContext, ValidationResult } from '@rastaweb/nest-sentinel';

/**
 * Custom strategy example - Premium access validation
 * This demonstrates how to create custom validation logic
 */
@Injectable()
export class CustomStrategy extends SentinelStrategy {
  readonly name = 'custom';

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { clientIP, apiKey, headers, routeOptions } = context;

    try {
      // Skip validation if explicitly requested
      if (routeOptions?.skip) {
        return { allowed: true };
      }

      // Custom business logic - premium access validation
      if (routeOptions?.strategy === 'premium') {
        return this.validatePremiumAccess(context);
      }

      // Custom business hours validation
      if (routeOptions?.strategy === 'business-hours') {
        return this.validateBusinessHours(context);
      }

      // Geographic restriction example
      if (routeOptions?.strategy === 'geo-restricted') {
        return this.validateGeographicRestriction(context);
      }

      // Default custom validation
      return this.validateDefault(context);
    } catch (error) {
      return {
        allowed: false,
        reason: `Custom validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { strategy: 'custom', error: true }
      };
    }
  }

  private async validatePremiumAccess(context: ValidationContext): Promise<ValidationResult> {
    const { apiKey, clientIP } = context;

    // Require API key for premium access
    if (!apiKey) {
      return {
        allowed: false,
        reason: 'Premium access requires API key',
        metadata: { strategy: 'premium', requirement: 'api_key' }
      };
    }

    // Check if API key indicates premium tier
    const isPremiumKey = apiKey.includes('premium') || apiKey.includes('admin');
    
    if (!isPremiumKey) {
      return {
        allowed: false,
        reason: 'Premium access requires premium API key',
        metadata: { strategy: 'premium', tier: 'standard' }
      };
    }

    // Additional premium validations
    const isFromAllowedNetwork = this.isFromPremiumNetwork(clientIP);
    
    if (!isFromAllowedNetwork) {
      return {
        allowed: false,
        reason: 'Premium access requires connection from approved network',
        metadata: { strategy: 'premium', clientIP, requirement: 'approved_network' }
      };
    }

    return {
      allowed: true,
      metadata: { 
        strategy: 'premium', 
        tier: 'premium',
        clientIP,
        validated: true
      }
    };
  }

  private validateBusinessHours(context: ValidationContext): ValidationResult {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Business hours: Monday-Friday, 9 AM - 5 PM
    const isBusinessDay = day >= 1 && day <= 5;
    const isBusinessHour = hour >= 9 && hour < 17;

    if (!isBusinessDay || !isBusinessHour) {
      return {
        allowed: false,
        reason: 'Access restricted to business hours (Mon-Fri, 9 AM - 5 PM)',
        metadata: {
          strategy: 'business-hours',
          currentTime: now.toISOString(),
          businessDay: isBusinessDay,
          businessHour: isBusinessHour
        }
      };
    }

    return {
      allowed: true,
      metadata: {
        strategy: 'business-hours',
        currentTime: now.toISOString(),
        accessGranted: 'within_business_hours'
      }
    };
  }

  private validateGeographicRestriction(context: ValidationContext): ValidationResult {
    const { clientIP, headers } = context;

    // Simulate geographic validation based on IP
    const allowedRegions = this.getAllowedRegionsForIP(clientIP);
    const clientRegion = this.getRegionFromIP(clientIP);

    if (!allowedRegions.includes(clientRegion)) {
      return {
        allowed: false,
        reason: `Access restricted from region: ${clientRegion}`,
        metadata: {
          strategy: 'geo-restricted',
          clientIP,
          clientRegion,
          allowedRegions
        }
      };
    }

    // Check for VPN/Proxy indicators
    const cloudflareCountry = headers['cf-ipcountry'] as string;
    const suspiciousHeaders = this.checkForVPNHeaders(headers);

    if (suspiciousHeaders.length > 0) {
      return {
        allowed: false,
        reason: 'VPN/Proxy usage detected',
        metadata: {
          strategy: 'geo-restricted',
          suspiciousHeaders,
          policy: 'no_vpn_proxy'
        }
      };
    }

    return {
      allowed: true,
      metadata: {
        strategy: 'geo-restricted',
        clientRegion,
        cloudflareCountry,
        accessGranted: 'geographic_validation_passed'
      }
    };
  }

  private validateDefault(context: ValidationContext): ValidationResult {
    const { clientIP, apiKey } = context;

    // Default custom validation - basic IP + optional API key
    const isLocalNetwork = this.isLocalNetwork(clientIP);
    
    if (isLocalNetwork) {
      return {
        allowed: true,
        metadata: {
          strategy: 'custom',
          clientIP,
          network: 'local',
          accessMethod: 'local_network'
        }
      };
    }

    // External access requires API key
    if (!apiKey) {
      return {
        allowed: false,
        reason: 'External access requires API key',
        metadata: {
          strategy: 'custom',
          clientIP,
          network: 'external',
          requirement: 'api_key'
        }
      };
    }

    return {
      allowed: true,
      metadata: {
        strategy: 'custom',
        clientIP,
        network: 'external',
        accessMethod: 'api_key_validated'
      }
    };
  }

  private isFromPremiumNetwork(ip: string): boolean {
    // Simulate premium network validation
    // In reality, this would check against a database of approved networks
    const premiumNetworks = [
      '192.168.0.0/16',
      '10.0.0.0/8',
      '127.0.0.1'
    ];

    return premiumNetworks.some(network => {
      if (network.includes('/')) {
        // CIDR range check (simplified)
        const [networkIP] = network.split('/');
        return ip.startsWith(networkIP.split('.').slice(0, 2).join('.'));
      }
      return ip === network;
    });
  }

  private getAllowedRegionsForIP(ip: string): string[] {
    // Simulate region-based access control
    if (ip.startsWith('192.168.') || ip === '127.0.0.1') {
      return ['US', 'CA', 'EU']; // Local networks have global access
    }
    
    // Default allowed regions for external IPs
    return ['US', 'CA'];
  }

  private getRegionFromIP(ip: string): string {
    // Simplified region detection
    if (ip.startsWith('192.168.') || ip === '127.0.0.1') {
      return 'US'; // Assume local is US
    }
    
    // In reality, you'd use a GeoIP service
    return 'UNKNOWN';
  }

  private checkForVPNHeaders(headers: Record<string, string | string[]>): string[] {
    const suspicious: string[] = [];
    
    // Common VPN/Proxy detection headers
    const vpnIndicators = [
      'x-forwarded-for',
      'x-real-ip',
      'x-proxy-user-ip',
      'cf-connecting-ip'
    ];

    vpnIndicators.forEach(header => {
      if (headers[header]) {
        const value = Array.isArray(headers[header]) 
          ? (headers[header] as string[])[0] 
          : headers[header] as string;
        
        // Check for multiple IPs (proxy chain)
        if (value.includes(',')) {
          suspicious.push(header);
        }
      }
    });

    return suspicious;
  }

  private isLocalNetwork(ip: string): boolean {
    return ip.startsWith('192.168.') || 
           ip.startsWith('10.') || 
           ip.startsWith('172.16.') ||
           ip === '127.0.0.1';
  }
}