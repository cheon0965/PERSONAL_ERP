import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse } from '@personal-erp/contracts';
import * as argon2 from 'argon2';
import { getAccessTokenSecret, getAccessTokenTtl, getRefreshTokenSecret, getRefreshTokenTtl } from '../../common/auth/jwt-config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse & { refreshToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { secret: getAccessTokenSecret(), expiresIn: getAccessTokenTtl() }
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      { secret: getRefreshTokenSecret(), expiresIn: getRefreshTokenTtl() }
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name }
    };
  }
}
