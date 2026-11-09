import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Supports the bounded base64 payload limit enforced by the AI service.
  app.useBodyParser('json', { limit: '28mb' });

  const allowedOrigins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('WEB_ORIGIN must contain the allowed frontend origin(s) in production');
  }

  app.enableCors({
    // Never reflect arbitrary request origins. Local development is limited
    // to the standard Next.js development origin.
    origin: allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }

  await app.listen(port, '0.0.0.0');
  console.log('Inventory API listening on port ' + port);
}

void bootstrap();
