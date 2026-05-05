import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../users/domain/user.repository';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userRepo.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '1d');
    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    }, {
      expiresIn: expiresIn
    });

    const { exp } = this.jwtService.decode(token) as { exp: number };
    const expiresAt = new Date(exp * 1000);

    return {
      token,
      expires_at: expiresAt.toISOString(),
      user_id: user.id,
      username: user.username,
      role: user.role,
    };
  }
}
