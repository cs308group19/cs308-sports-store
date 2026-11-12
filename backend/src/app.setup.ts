import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Env } from './config/env.js';

/** Shared by main.ts and the e2e tests so both run with the same pipes, prefix and CORS. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  // The rate limiter keys on req.ip. Behind a proxy that is the proxy's address unless Express
  // is told how many hops to trust, and then every client would share one limit.
  express.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
