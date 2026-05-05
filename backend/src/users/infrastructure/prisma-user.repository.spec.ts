import { Test, TestingModule } from '@nestjs/testing';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { UserEntity } from '../domain/user.entity';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockUser: UserEntity = {
  id: 'user-1',
  username: 'alice',
  passwordHash: 'hashed-pw',
  role: 'USER',
  createdAt: new Date(),
};

describe('PrismaUserRepository', () => {
  let repo: PrismaUserRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaUserRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<PrismaUserRepository>(PrismaUserRepository);
  });

  describe('findById()', () => {
    it('should return null when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findById('user-x');

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-x' } });
    });

    it('should return user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-1');

      expect(result).toEqual(mockUser);
    });
  });

  describe('findByUsername()', () => {
    it('should return null when username does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findByUsername('nobody');

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'nobody' } });
    });

    it('should return user when username is found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByUsername('alice');

      expect(result).toEqual(mockUser);
    });
  });

  describe('create()', () => {
    it('should create user with username and passwordHash', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await repo.create({ username: 'alice', passwordHash: 'hashed-pw' });

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { username: 'alice', passwordHash: 'hashed-pw' },
      });
    });
  });
});
