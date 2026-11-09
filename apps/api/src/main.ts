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
  app.enableCors({
    origin: process.env.WEB_ORIGIN
      ? process.env.WEB_ORIGIN.split(',').map((value) => value.trim())
      : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log('Inventory API listening on port ' + port);
}

void bootstrap();
