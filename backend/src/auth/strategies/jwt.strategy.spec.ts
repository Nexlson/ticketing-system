import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy({
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService);
  });

  describe('validate()', () => {
    it('should return payload when sub is present', () => {
      const payload: JwtPayload = { sub: 'user-1', username: 'alice', role: 'USER' };

      const result = strategy.validate(payload);

      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException when sub is missing', () => {
      const invalidPayload = { username: 'alice', role: 'USER' } as JwtPayload;

      expect(() => strategy.validate(invalidPayload)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when sub is empty string', () => {
      const invalidPayload: JwtPayload = { sub: '', username: 'alice', role: 'USER' };

      expect(() => strategy.validate(invalidPayload)).toThrow(UnauthorizedException);
    });
  });
});
