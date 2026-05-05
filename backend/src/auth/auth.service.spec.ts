import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserRepository } from '../users/domain/user.repository';
import { UserEntity } from '../users/domain/user.entity';

jest.mock('bcrypt');

const mockUser: UserEntity = {
  id: 'user-1',
  username: 'testuser',
  passwordHash: 'hashed-pw',
  role: 'USER',
  createdAt: new Date('2024-01-01'),
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign' | 'decode'>>;

  beforeEach(async () => {
    userRepo = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
    } as any;

    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('1d') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login()', () => {
    it('should throw UnauthorizedException when user is not found', async () => {
      userRepo.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'nobody', password: 'pass123' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'testuser', password: 'wrongpass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return login response when credentials are valid', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'testuser', password: 'correct123' });

      expect(result.token).toBe('signed-token');
      expect(result.user_id).toBe('user-1');
      expect(result.username).toBe('testuser');
      expect(result.role).toBe('USER');
    });

    it('should sign JWT with sub, username, and role from user entity', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({ username: 'testuser', password: 'correct123' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-1', username: 'testuser', role: 'USER' },
        { expiresIn: '1d' },
      );
    });

    it('should return expires_at as ISO string derived from token exp claim', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'testuser', password: 'correct123' });

      expect(result.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should use JWT_EXPIRES_IN from config when signing token', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({ username: 'testuser', password: 'correct123' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        { expiresIn: '1d' },
      );
    });
  });
});
