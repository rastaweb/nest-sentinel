import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { Sentinel } from '@rastaweb/nest-sentinel';
import { Request } from 'express';

/**
 * Admin endpoints with strict access controls
 */
@Controller('admin')
export class AdminController {

  /**
   * User management - very strict validation
   */
  @Sentinel({
    ip: {
      type: 'ip',
      whitelist: ['192.168.0.0/24', '10.0.0.0/8'], // Only specific admin networks
      allowPrivate: true,
      allowLoopback: true
    },
    apiKey: {
      type: 'apiKey',
      header: 'x-admin-token',
      required: true,
      validateKey: true
    }
  })
  @Get('users')
  getUsers(@Req() req: Request) {
    return {
      message: 'Admin access granted - User list',
      clientIP: req.ip,
      users: [
        { id: 1, name: 'John Doe', role: 'admin' },
        { id: 2, name: 'Jane Smith', role: 'user' },
        { id: 3, name: 'Bob Johnson', role: 'moderator' }
      ],
      timestamp: new Date().toISOString(),
      accessLevel: 'admin'
    };
  }

  /**
   * System configuration - requires admin token
   */
  @Sentinel({
    ip: ['127.0.0.1', '192.168.0.0/24'], // Localhost or admin network only
    apiKey: {
      type: 'apiKey',
      header: 'x-admin-token',
      required: true,
      validateKey: true
    }
  })
  @Get('system')
  getSystemInfo(@Req() req: Request) {
    return {
      message: 'System information access granted',
      clientIP: req.ip,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date().toISOString(),
      accessLevel: 'admin'
    };
  }

  /**
   * Configuration management
   */
  @Sentinel({
    ip: {
      type: 'ip',
      whitelist: ['127.0.0.1'],  // Localhost only
      allowLoopback: true
    },
    apiKey: {
      type: 'apiKey',
      header: 'x-admin-token',
      required: true,
      validateKey: true
    }
  })
  @Get('config')
  getConfig(@Req() req: Request) {
    return {
      message: 'Configuration access granted',
      clientIP: req.ip,
      config: {
        sentinelEnabled: true,
        defaultStrategy: 'default',
        logLevel: 'info',
        features: {
          ipValidation: true,
          apiKeyValidation: true,
          customStrategies: true
        }
      },
      timestamp: new Date().toISOString(),
      accessLevel: 'admin'
    };
  }

  /**
   * Create user - POST endpoint with admin validation
   */
  @Sentinel({
    ip: ['127.0.0.1', '192.168.0.0/24'],
    apiKey: {
      type: 'apiKey',
      header: 'x-admin-token',
      required: true,
      validateKey: true
    }
  })
  @Post('users')
  createUser(@Body() userData: any, @Req() req: Request) {
    return {
      message: 'User creation access granted',
      clientIP: req.ip,
      action: 'create_user',
      userData: {
        name: userData.name || 'New User',
        email: userData.email || 'user@example.com',
        role: userData.role || 'user'
      },
      timestamp: new Date().toISOString(),
      accessLevel: 'admin'
    };
  }

  /**
   * Delete user - very strict validation
   */
  @Sentinel({
    ip: {
      type: 'ip',
      whitelist: ['127.0.0.1'], // Only localhost can delete users
      allowLoopback: true
    },
    apiKey: {
      type: 'apiKey',
      header: 'x-admin-token',
      required: true,
      validateKey: true
    }
  })
  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Req() req: Request) {
    return {
      message: 'User deletion access granted',
      clientIP: req.ip,
      action: 'delete_user',
      userId: id,
      warning: 'This would delete the user in a real application',
      timestamp: new Date().toISOString(),
      accessLevel: 'admin'
    };
  }

  /**
   * Emergency access - localhost only, no API key required
   */
  @Sentinel({
    ip: ['127.0.0.1'],
    apiKey: false // No API key required for emergency access
  })
  @Get('emergency')
  getEmergencyAccess(@Req() req: Request) {
    return {
      message: 'Emergency access granted from localhost',
      clientIP: req.ip,
      emergency: {
        status: 'system_operational',
        lastBackup: '2024-01-01T00:00:00Z',
        diskSpace: '75%',
        memoryUsage: '45%'
      },
      timestamp: new Date().toISOString(),
      accessLevel: 'emergency'
    };
  }
}