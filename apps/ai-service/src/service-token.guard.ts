import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredToken = process.env.AI_SERVICE_TOKEN;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const suppliedHeader = request.headers['x-internal-service-token'];
    const suppliedToken = Array.isArray(suppliedHeader) ? suppliedHeader[0] : suppliedHeader;

    if (!configuredToken || !suppliedToken) {
      throw new UnauthorizedException();
    }

    const expected = Buffer.from(configuredToken);
    const actual = Buffer.from(suppliedToken);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
