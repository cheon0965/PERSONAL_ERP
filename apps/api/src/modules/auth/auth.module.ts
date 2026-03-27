import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthRateLimitService,
    AuthService,
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard
    }
  ],
  exports: [AuthService, JwtModule]
})
export class AuthModule {}
