import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-internal-key'];
    const configuredKey =
      this.configService.getOrThrow<string>('INTERNAL_API_KEY');

    if (!providedKey || providedKey !== configuredKey) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
