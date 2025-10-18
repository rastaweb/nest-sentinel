import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { 
  Sentinel, 
  IPOnly, 
  APIKeyOnly, 
  PrivateNetworkOnly, 
  RequireBoth,
  BlockIPs 
} from '@rastaweb/nest-sentinel';
import { Request } from 'express';

/**
 * Protected endpoints demonstrating various validation patterns
 */
@Controller('protected')
export class ProtectedController {

  /**
   * Basic IP validation - only allows specific IP ranges
   */
  @IPOnly(['192.168.0.0/16', '10.0.0.0/8', '127.0.0.1'])
  @Get('basic')
  getBasicProtected(@Req() req: Request) {
    return {
      message: 'Access granted with IP validation',
      clientIP: req.ip,
      allowedRanges: ['192.168.0.0/16', '10.0.0.0/8', '127.0.0.1'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * API key validation only
   */
  @APIKeyOnly({ header: 'x-api-key', required: true })
  @Get('api-key')
  getAPIKeyProtected(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    return {
      message: 'Access granted with API key validation',
      apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'none',
      timestamp: new Date().toISOString(),
      instructions: 'Send request with header: x-api-key: your-api-key'
    };
  }

  /**
   * Combined IP and API key validation
   */
  @RequireBoth({
    allowedIPs: ['192.168.0.0/16', '10.0.0.0/8', '127.0.0.1'],
    apiKeyHeader: 'x-api-key'
  })
  @Get('combined')
  getCombinedProtected(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    return {
      message: 'Access granted with both IP and API key validation',
      clientIP: req.ip,
      apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'none',
      timestamp: new Date().toISOString(),
      requirements: {
        ip: 'Must be from allowed IP ranges',
        apiKey: 'Must provide valid API key in x-api-key header'
      }
    };
  }

  /**
   * Private network only access
   */
  @PrivateNetworkOnly()
  @Get('private-network')
  getPrivateNetworkProtected(@Req() req: Request) {
    return {
      message: 'Access granted from private network',
      clientIP: req.ip,
      allowedNetworks: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Block specific IPs while allowing others
   */
  @BlockIPs(['192.168.1.100', '10.0.0.50'])
  @Get('blocked-ips')
  getBlockedIPsProtected(@Req() req: Request) {
    return {
      message: 'Access granted - IP not in blocked list',
      clientIP: req.ip,
      blockedIPs: ['192.168.1.100', '10.0.0.50'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Custom validation rules using the main Sentinel decorator
   */
  @Sentinel({
    ip: {
      type: 'ip',
      whitelist: ['192.168.0.0/24'],
      allowPrivate: true,
      allowLoopback: true
    },
    apiKey: {
      type: 'apiKey',
      header: 'authorization',
      required: false,
      validateKey: true
    }
  })
  @Get('custom-rules')
  getCustomRulesProtected(@Req() req: Request) {
    const authHeader = req.headers['authorization'] as string;
    return {
      message: 'Access granted with custom validation rules',
      clientIP: req.ip,
      authorization: authHeader ? 'Present' : 'Not provided',
      rules: {
        ip: 'Must be from 192.168.0.0/24 or private/loopback',
        apiKey: 'Optional authorization header validation'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * POST endpoint with validation
   */
  @Sentinel({
    ip: ['127.0.0.1', '192.168.0.0/16'],
    apiKey: true
  })
  @Post('data')
  postProtectedData(@Body() data: any, @Req() req: Request) {
    return {
      message: 'Data received and processed',
      clientIP: req.ip,
      dataReceived: data,
      timestamp: new Date().toISOString(),
      validation: 'IP and API key validated'
    };
  }

  /**
   * Multiple validation rules example
   */
  @Sentinel({
    rules: [
      {
        type: 'ip',
        whitelist: ['192.168.0.0/16'],
        allowLoopback: true
      },
      {
        type: 'apiKey',
        header: 'x-custom-key',
        required: true,
        validateKey: true
      }
    ]
  })
  @Get('multiple-rules')
  getMultipleRulesProtected(@Req() req: Request) {
    const customKey = req.headers['x-custom-key'] as string;
    return {
      message: 'Access granted with multiple validation rules',
      clientIP: req.ip,
      customKey: customKey ? `${customKey.substring(0, 8)}...` : 'none',
      appliedRules: [
        'IP must be from 192.168.0.0/16 or loopback',
        'Custom API key required in x-custom-key header'
      ],
      timestamp: new Date().toISOString()
    };
  }
}