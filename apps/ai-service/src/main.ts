import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '28mb' });
  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port, '0.0.0.0');
  console.log('Inventory AI Service listening on port ' + port);
}

void bootstrap();
