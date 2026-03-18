import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';

async function bootstrap() {
  const env = validateEnv({
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    APP_ENV: process.env.APP_ENV ?? 'development',
    API_HOST: process.env.API_HOST ?? '0.0.0.0',
    API_PORT: process.env.API_PORT ?? '3000',
    APP_DISPLAY_NAME: process.env.APP_DISPLAY_NAME ?? 'Event App',
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/event_app?schema=public',
    PUBLIC_INVITE_BASE_URL:
      process.env.PUBLIC_INVITE_BASE_URL ?? 'http://localhost:3000/api/v1/invite-links',
  });

  process.env.PUBLIC_INVITE_BASE_URL = env.PUBLIC_INVITE_BASE_URL;

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder().setTitle('Event App API').setVersion('1.0').build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(env.API_PORT, env.API_HOST);
}

bootstrap();
