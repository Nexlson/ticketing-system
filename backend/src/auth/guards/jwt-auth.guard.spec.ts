import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('should be an instance of AuthGuard with jwt strategy', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeInstanceOf(AuthGuard('jwt'));
  });

  it('should be defined', () => {
    expect(new JwtAuthGuard()).toBeDefined();
  });

  it('should inherit canActivate from AuthGuard', () => {
    const guard = new JwtAuthGuard();
    expect(typeof guard.canActivate).toBe('function');
  });
});
