import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiKeyService } from '../api-key.service';
import { ApiKey } from '../../entities/api-key.entity';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let repository: jest.Mocked<Repository<ApiKey>>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    repository = module.get(getRepositoryToken(ApiKey));

    // Reset all mocks
    Object.values(mockRepository).forEach((mock) => mock.mockReset());
  });

  describe('createKey', () => {
    it('should create an API key successfully', async () => {
      const mockApiKey = {
        id: 'test-id',
        name: 'Test Key',
        key: 'hashed-key',
        ownerType: 'service' as const,
        ownerId: 'test-service',
        scopes: ['read', 'write'],
        isActive: true,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockApiKey as any);
      mockRepository.save.mockResolvedValue(mockApiKey as any);

      const result = await service.createKey(
        'service',
        'test-service',
        ['read', 'write'],
        'Test Key',
      );

      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('rawKey');
      expect(result.apiKey.name).toBe('Test Key');
      expect(result.apiKey.ownerType).toBe('service');
      expect(result.apiKey.ownerId).toBe('test-service');
      expect(result.apiKey.scopes).toEqual(['read', 'write']);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create key with expiration date', async () => {
      const expiresAt = new Date(Date.now() + 86400000); // 24 hours
      const mockApiKey = {
        id: 'test-id',
        name: 'Test Key',
        key: 'hashed-key',
        ownerType: 'user' as const,
        ownerId: 'test-user',
        scopes: ['read'],
        isActive: true,
        createdAt: new Date(),
        expiresAt,
      };

      mockRepository.create.mockReturnValue(mockApiKey as any);
      mockRepository.save.mockResolvedValue(mockApiKey as any);

      const result = await service.createKey(
        'user',
        'test-user',
        ['read'],
        'Test Key',
        expiresAt,
      );

      expect(result.apiKey.expiresAt).toEqual(expiresAt);
    });
  });

  describe('validateKey', () => {
    it('should validate a correct API key', async () => {
      const rawKey = 'test-raw-key';
      const hashedKey = await bcrypt.hash(rawKey, 10);

      const mockApiKey = {
        id: 'test-id',
        name: 'Test Key',
        key: hashedKey,
        ownerType: 'service' as const,
        ownerId: 'test-service',
        scopes: ['read', 'write'],
        isActive: true,
        createdAt: new Date(),
      };

      mockRepository.find.mockResolvedValue([mockApiKey] as any);
      mockRepository.update = jest.fn().mockResolvedValue({});

      const result = await service.validateKey(rawKey);

      expect(result.valid).toBe(true);
      expect(result.apiKeyRecord?.id).toBe('test-id');
      expect(result.apiKeyRecord?.scopes).toEqual(['read', 'write']);
    });

    it('should return invalid for wrong API key', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.validateKey('invalid-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should return invalid for expired API key', async () => {
      const rawKey = 'test-raw-key';
      const hashedKey = await bcrypt.hash(rawKey, 10);

      const mockApiKey = {
        id: 'test-id',
        key: hashedKey,
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        ownerType: 'service' as const,
        ownerId: 'test-service',
        scopes: ['read'],
      };

      mockRepository.find.mockResolvedValue([mockApiKey] as any);

      const result = await service.validateKey(rawKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key has expired');
    });

    it('should return invalid for missing scope', async () => {
      const rawKey = 'test-raw-key';
      const hashedKey = await bcrypt.hash(rawKey, 10);

      const mockApiKey = {
        id: 'test-id',
        key: hashedKey,
        isActive: true,
        ownerType: 'service' as const,
        ownerId: 'test-service',
        scopes: ['read'],
      };

      mockRepository.find.mockResolvedValue([mockApiKey] as any);

      const result = await service.validateKey(rawKey, 'write');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required scope: write');
    });
  });

  describe('invalidateKey', () => {
    it('should invalidate an API key', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.invalidateKey('test-id');

      expect(result).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: 'test-id' },
        { isActive: false },
      );
    });

    it('should return false if key not found', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.invalidateKey('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('listByOwner', () => {
    it('should list keys for an owner', async () => {
      const mockKeys = [
        {
          id: 'key1',
          name: 'Key 1',
          ownerType: 'service' as const,
          ownerId: 'test-service',
          scopes: ['read'],
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'key2',
          name: 'Key 2',
          ownerType: 'service' as const,
          ownerId: 'test-service',
          scopes: ['write'],
          isActive: true,
          createdAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockKeys as any);

      const result = await service.listByOwner('service', 'test-service');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('key1');
      expect(result[1].id).toBe('key2');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { ownerType: 'service', ownerId: 'test-service' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getById', () => {
    it('should get an API key by ID', async () => {
      const mockApiKey = {
        id: 'test-id',
        name: 'Test Key',
        ownerType: 'service' as const,
        ownerId: 'test-service',
        scopes: ['read'],
        isActive: true,
        createdAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockApiKey as any);

      const result = await service.getById('test-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-id');
      expect(result?.name).toBe('Test Key');
    });

    it('should return null for non-existent key', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getById('non-existent-id');

      expect(result).toBeNull();
    });
  });
});
