import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ApiKey } from '../entities';
import { OwnerType, ValidationResult, ApiKeyRecord } from '../interfaces';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  /**
   * Create a new API key
   */
  async createKey(
    ownerType: OwnerType,
    ownerId: string,
    scopes: string[] = [],
    name?: string,
    expiresAt?: Date,
  ): Promise<{ apiKey: ApiKeyRecord; rawKey: string }> {
    const rawKey = this.generateApiKey();
    const hashedKey = await this.hashKey(rawKey);

    const apiKey = this.apiKeyRepository.create({
      name: name || `${ownerType}-${ownerId}-${Date.now()}`,
      key: hashedKey,
      ownerType,
      ownerId,
      scopes,
      isActive: true,
      expiresAt,
    });

    const saved = await this.apiKeyRepository.save(apiKey);

    this.logger.log(
      `Created API key for ${ownerType}:${ownerId} with scopes: [${scopes.join(', ')}]`,
    );

    return {
      apiKey: this.mapToRecord(saved),
      rawKey,
    };
  }

  /**
   * Validate an API key and optional scope
   */
  async validateKey(
    key: string,
    requiredScope?: string,
  ): Promise<ValidationResult> {
    try {
      // Find all active API keys
      const apiKeys = await this.apiKeyRepository.find({
        where: { isActive: true },
      });

      // Check each key against the provided key
      for (const apiKey of apiKeys) {
        if (await this.compareKey(key, apiKey.key)) {
          // Check if key is expired
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            return {
              valid: false,
              error: 'API key has expired',
            };
          }

          // Check scope if required
          if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
            return {
              valid: false,
              error: `Missing required scope: ${requiredScope}`,
            };
          }

          // Update last used timestamp
          await this.updateLastUsed(apiKey.id);

          return {
            valid: true,
            apiKeyRecord: this.mapToRecord(apiKey),
          };
        }
      }

      return {
        valid: false,
        error: 'Invalid API key',
      };
    } catch (error) {
      this.logger.error('Error validating API key:', error);
      return {
        valid: false,
        error: 'Validation failed',
      };
    }
  }

  /**
   * Invalidate an API key by ID
   */
  async invalidateKey(id: string): Promise<boolean> {
    try {
      const result = await this.apiKeyRepository.update(
        { id },
        { isActive: false },
      );

      if (result.affected && result.affected > 0) {
        this.logger.log(`Invalidated API key: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error invalidating API key:', error);
      return false;
    }
  }

  /**
   * Rotate an API key (create new, invalidate old)
   */
  async rotateKey(
    id: string,
  ): Promise<{ apiKey: ApiKeyRecord; rawKey: string } | null> {
    try {
      const existingKey = await this.apiKeyRepository.findOne({
        where: { id, isActive: true },
      });

      if (!existingKey) {
        return null;
      }

      // Create new key with same properties
      const newKeyResult = await this.createKey(
        existingKey.ownerType,
        existingKey.ownerId,
        existingKey.scopes,
        existingKey.name,
        existingKey.expiresAt,
      );

      // Invalidate old key
      await this.invalidateKey(id);

      this.logger.log(`Rotated API key: ${id} -> ${newKeyResult.apiKey.id}`);

      return newKeyResult;
    } catch (error) {
      this.logger.error('Error rotating API key:', error);
      return null;
    }
  }

  /**
   * Get API key by ID
   */
  async getById(id: string): Promise<ApiKeyRecord | null> {
    try {
      const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
      return apiKey ? this.mapToRecord(apiKey) : null;
    } catch (error) {
      this.logger.error('Error getting API key by ID:', error);
      return null;
    }
  }

  /**
   * List API keys for an owner
   */
  async listByOwner(
    ownerType: OwnerType,
    ownerId: string,
  ): Promise<ApiKeyRecord[]> {
    try {
      const apiKeys = await this.apiKeyRepository.find({
        where: { ownerType, ownerId },
        order: { createdAt: 'DESC' },
      });

      return apiKeys.map((key) => this.mapToRecord(key));
    } catch (error) {
      this.logger.error('Error listing API keys:', error);
      return [];
    }
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    return `ak_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Hash an API key for storage
   */
  private async hashKey(key: string): Promise<string> {
    return await bcrypt.hash(key, 12);
  }

  /**
   * Compare a raw key with a hashed key
   */
  private async compareKey(
    rawKey: string,
    hashedKey: string,
  ): Promise<boolean> {
    return await bcrypt.compare(rawKey, hashedKey);
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(id: string): Promise<void> {
    await this.apiKeyRepository.update({ id }, { lastUsedAt: new Date() });
  }

  /**
   * Map entity to record interface
   */
  private mapToRecord(entity: ApiKey): ApiKeyRecord {
    return {
      id: entity.id,
      name: entity.name,
      key: entity.key, // This is hashed
      ownerType: entity.ownerType,
      ownerId: entity.ownerId,
      scopes: entity.scopes,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      expiresAt: entity.expiresAt,
      lastUsedAt: entity.lastUsedAt,
    };
  }
}
