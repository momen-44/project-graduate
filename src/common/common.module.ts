import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard, InternalApiKeyGuard],
  exports: [JwtModule, JwtAuthGuard, InternalApiKeyGuard],
})
export class CommonModule {}
