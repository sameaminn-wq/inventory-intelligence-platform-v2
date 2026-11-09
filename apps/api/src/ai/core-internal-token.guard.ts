import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class CoreInternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.CORE_INTERNAL_API_TOKEN;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = request.headers['x-core-internal-token'];
    const suppliedToken = Array.isArray(header) ? header[0] : header;

    if (!expectedToken || !suppliedToken) throw new UnauthorizedException();
    const expected = Buffer.from(expectedToken);
    const actual = Buffer.from(suppliedToken);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
