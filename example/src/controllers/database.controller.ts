import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Sentinel } from '@rastaweb/nest-sentinel';
import { Request } from 'express';
import { DatabaseService } from '../services/database.service';

/**
 * Controller demonstrating database-backed validation
 */
@Controller('database')
export class DatabaseController {

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get users with database-backed validation
   */
  @Sentinel({
    apiKey: {
      type: 'apiKey',
      header: 'x-api-key',
      required: true,
      validateKey: true
    }
  })
  @Get('users')
  async getUsers(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    
    // Validate user permissions through database
    const validation = await this.databaseService.validateUserPermissions(apiKey);
    
    if (!validation.valid) {
      return {
        error: validation.reason,
        timestamp: new Date().toISOString()
      };
    }

    const users = await this.databaseService.getAllUsers();
    
    return {
      message: 'Database access granted',
      clientIP: req.ip,
      requestingUser: validation.user,
      users,
      timestamp: new Date().toISOString(),
      validation: 'database_backed'
    };
  }

  /**
   * Get API key statistics (admin only)
   */
  @Sentinel({
    apiKey: {
      type: 'apiKey',
      header: 'x-api-key',
      required: true,
      validateKey: true
    }
  })
  @Get('api-keys')
  async getAPIKeyStats(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    
    // Validate admin permissions
    const validation = await this.databaseService.validateUserPermissions(apiKey, 'admin');
    
    if (!validation.valid) {
      return {
        error: validation.reason,
        requiredRole: 'admin',
        timestamp: new Date().toISOString()
      };
    }

    const stats = await this.databaseService.getApiKeyStatistics();
    
    return {
      message: 'API key statistics',
      clientIP: req.ip,
      requestingUser: validation.user,
      statistics: stats,
      timestamp: new Date().toISOString(),
      validation: 'admin_access'
    };
  }

  /**
   * Create new user (admin only)
   */
  @Sentinel({
    ip: ['127.0.0.1', '192.168.0.0/16'], // Admin networks only
    apiKey: {
      type: 'apiKey',
      header: 'x-api-key',
      required: true,
      validateKey: true
    }
  })
  @Post('users')
  async createUser(@Body() userData: { name: string; role: string }, @Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    
    // Validate admin permissions
    const validation = await this.databaseService.validateUserPermissions(apiKey, 'admin');
    
    if (!validation.valid) {
      return {
        error: validation.reason,
        requiredRole: 'admin',
        timestamp: new Date().toISOString()
      };
    }

    const newUser = await this.databaseService.createUser(userData);
    
    return {
      message: 'User created successfully',
      clientIP: req.ip,
      requestingUser: validation.user,
      newUser,
      timestamp: new Date().toISOString(),
      validation: 'admin_creation'
    };
  }

  /**
   * User profile endpoint - users can only see their own data
   */
  @Sentinel({
    apiKey: {
      type: 'apiKey',
      header: 'x-api-key',
      required: true,
      validateKey: true
    }
  })
  @Get('profile')
  async getUserProfile(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    
    const user = await this.databaseService.getUserByApiKey(apiKey);
    
    if (!user) {
      return {
        error: 'Invalid API key',
        timestamp: new Date().toISOString()
      };
    }

    return {
      message: 'Profile access granted',
      clientIP: req.ip,
      profile: {
        id: user.id,
        name: user.name,
        role: user.role,
        // Don't expose the actual API key
        hasApiKey: true
      },
      timestamp: new Date().toISOString(),
      validation: 'user_profile_access'
    };
  }

  /**
   * Role-based access example
   */
  @Sentinel({
    apiKey: {
      type: 'apiKey',
      header: 'x-api-key',
      required: true,
      validateKey: true
    }
  })
  @Get('premium-data')
  async getPremiumData(@Req() req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    
    // Allow premium or admin users
    const user = await this.databaseService.getUserByApiKey(apiKey);
    
    if (!user) {
      return {
        error: 'Invalid API key',
        timestamp: new Date().toISOString()
      };
    }

    if (user.role !== 'premium' && user.role !== 'admin') {
      return {
        error: 'Premium access required',
        currentRole: user.role,
        requiredRole: 'premium or admin',
        timestamp: new Date().toISOString()
      };
    }

    return {
      message: 'Premium data access granted',
      clientIP: req.ip,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      premiumData: {
        advancedAnalytics: 'Available',
        prioritySupport: 'Enabled',
        customFeatures: 'Unlocked',
        apiRateLimit: 'Increased'
      },
      timestamp: new Date().toISOString(),
      validation: 'premium_access'
    };
  }
}