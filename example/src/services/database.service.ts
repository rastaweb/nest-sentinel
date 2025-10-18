import { Injectable } from '@nestjs/common';

/**
 * Simple database service simulation
 * In a real application, this would use TypeORM, Prisma, or another ORM
 */
@Injectable()
export class DatabaseService {
  private users = [
    { id: 1, name: 'John Doe', role: 'admin', apiKey: 'admin-key-456' },
    { id: 2, name: 'Jane Smith', role: 'user', apiKey: 'demo-key-123' },
    { id: 3, name: 'Bob Johnson', role: 'premium', apiKey: 'premium-key-789' }
  ];

  private sessions = new Map<string, { userId: number; createdAt: Date; lastActivity: Date }>();

  async getUserByApiKey(apiKey: string) {
    return this.users.find(user => user.apiKey === apiKey);
  }

  async getAllUsers() {
    return this.users.map(user => ({
      id: user.id,
      name: user.name,
      role: user.role,
      // Don't expose API keys in listings
      hasApiKey: !!user.apiKey
    }));
  }

  async createUser(userData: { name: string; role: string }) {
    const newUser = {
      id: this.users.length + 1,
      name: userData.name,
      role: userData.role,
      apiKey: `generated-key-${Date.now()}`
    };
    
    this.users.push(newUser);
    return {
      id: newUser.id,
      name: newUser.name,
      role: newUser.role,
      apiKey: newUser.apiKey
    };
  }

  async deleteUser(id: number) {
    const index = this.users.findIndex(user => user.id === id);
    if (index > -1) {
      const deletedUser = this.users.splice(index, 1)[0];
      return {
        deleted: true,
        user: {
          id: deletedUser.id,
          name: deletedUser.name,
          role: deletedUser.role
        }
      };
    }
    return { deleted: false, error: 'User not found' };
  }

  async createSession(userId: number, sessionId: string) {
    this.sessions.set(sessionId, {
      userId,
      createdAt: new Date(),
      lastActivity: new Date()
    });
  }

  async getSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  async validateUserPermissions(apiKey: string, requiredRole?: string) {
    const user = await this.getUserByApiKey(apiKey);
    if (!user) return { valid: false, reason: 'Invalid API key' };

    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
      return { valid: false, reason: `Requires ${requiredRole} role` };
    }

    return { valid: true, user: { id: user.id, name: user.name, role: user.role } };
  }

  async getApiKeyStatistics() {
    return {
      totalKeys: this.users.filter(u => u.apiKey).length,
      activeKeys: this.users.filter(u => u.apiKey).length, // All are considered active in this demo
      keysByRole: {
        admin: this.users.filter(u => u.role === 'admin').length,
        premium: this.users.filter(u => u.role === 'premium').length,
        user: this.users.filter(u => u.role === 'user').length
      }
    };
  }
}