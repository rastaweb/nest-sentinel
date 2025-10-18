import { Controller, Get, Req } from '@nestjs/common';
import { SentinelStrategy } from '@rastaweb/nest-sentinel';
import { Request } from 'express';

/**
 * Controller demonstrating custom strategy usage
 */
@Controller('custom')
export class CustomStrategyController {

  /**
   * Premium access endpoint using custom strategy
   */
  @SentinelStrategy('premium')
  @Get('premium')
  getPremiumAccess(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    return {
      message: 'Premium access granted',
      clientIP: req.ip,
      apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'none',
      features: [
        'Advanced analytics',
        'Priority support',
        'Custom integrations',
        'Higher rate limits'
      ],
      timestamp: new Date().toISOString(),
      strategy: 'premium'
    };
  }

  /**
   * Business hours restricted endpoint
   */
  @SentinelStrategy('business-hours')
  @Get('business-hours')
  getBusinessHoursAccess(@Req() req: Request) {
    const now = new Date();
    return {
      message: 'Business hours access granted',
      clientIP: req.ip,
      currentTime: now.toISOString(),
      businessHours: 'Monday-Friday, 9 AM - 5 PM',
      timeZone: 'Server local time',
      timestamp: new Date().toISOString(),
      strategy: 'business-hours'
    };
  }

  /**
   * Geographic restriction example
   */
  @SentinelStrategy('geo-restricted')
  @Get('geo-restricted')
  getGeoRestrictedAccess(@Req() req: Request) {
    return {
      message: 'Geographic validation passed',
      clientIP: req.ip,
      allowedRegions: ['US', 'CA', 'EU'],
      detectedRegion: 'US', // Simplified for demo
      restrictions: {
        vpnBlocked: true,
        proxyBlocked: true,
        torBlocked: true
      },
      timestamp: new Date().toISOString(),
      strategy: 'geo-restricted'
    };
  }

  /**
   * Default custom strategy endpoint
   */
  @SentinelStrategy('custom')
  @Get('default')
  getCustomAccess(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    return {
      message: 'Custom strategy validation passed',
      clientIP: req.ip,
      apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'not provided',
      validationMethod: req.ip.startsWith('192.168.') || req.ip === '127.0.0.1' 
        ? 'local_network' 
        : 'api_key_required',
      timestamp: new Date().toISOString(),
      strategy: 'custom'
    };
  }
}