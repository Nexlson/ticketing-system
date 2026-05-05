import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'login'>>;

  const mockLoginResponse: LoginResponseDto = {
    token: 'signed-token',
    expires_at: '2025-06-01T00:00:00.000Z',
    user_id: 'user-1',
    username: 'testuser',
    role: 'USER',
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(mockLoginResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login()', () => {
    it('should delegate to AuthService.login() with the provided DTO', async () => {
      const dto: LoginDto = { username: 'testuser', password: 'secret123' };

      await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
    });

    it('should return the login response from AuthService', async () => {
      const dto: LoginDto = { username: 'testuser', password: 'secret123' };

      const result = await controller.login(dto);

      expect(result).toEqual(mockLoginResponse);
    });
  });
});
