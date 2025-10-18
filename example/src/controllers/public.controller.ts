import { Controller, Get } from '@nestjs/common';
import { SkipSentinel } from '@rastaweb/nest-sentinel';

/**
 * Public endpoints that bypass Sentinel validation
 */
@Controller('public')
export class PublicController {
  
  /**
   * Completely public endpoint - no validation
   */
  @SkipSentinel()
  @Get('info')
  getPublicInfo() {
    return {
      message: 'This is a public endpoint',
      timestamp: new Date().toISOString(),
      description: 'No Sentinel validation applied - accessible to everyone'
    };
  }

  /**
   * Health check endpoint
   */
  @SkipSentinel()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    };
  },

  /**
   * API documentation endpoint
   */
  @SkipSentinel()
  @Get('docs')
  getDocs() {
    return {
      title: 'Nest Sentinel Example API',
      description: 'Demonstrates various access control patterns',
      endpoints: {
        public: {
          '/public/info': 'Public information (no validation)',
          '/public/health': 'Health check (no validation)',
          '/public/docs': 'This documentation (no validation)'
        },
        protected: {
          '/protected/basic': 'Basic IP validation',
          '/protected/api-key': 'API key validation only',
          '/protected/combined': 'Both IP and API key validation',
          '/protected/private-network': 'Private network only',
          '/protected/specific-ips': 'Specific IP addresses only'
        },
        admin: {
          '/admin/users': 'Admin endpoint with strict validation',
          '/admin/system': 'System administration',
          '/admin/config': 'Configuration management'
        },
        custom: {
          '/custom/premium': 'Premium strategy example',
          '/custom/business-hours': 'Business hours validation',
          '/custom/geo-restricted': 'Geographic restrictions'
        },
        database: {
          '/database/users': 'Database-backed validation',
          '/database/api-keys': 'Dynamic API key management'
        }
      }
    };
  }
}