import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, type NextFunction, type Request, type Response } from 'express';
import { ASSISTANT_BODY_LIMIT } from './assistant/assistant.dto.js';
import { CheckoutValidationFilter } from './checkout/checkout-validation.filter.js';
import type { Env } from './config/env.js';

/** Shared by main.ts and the e2e tests so both run with the same pipes, prefix and CORS. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  // The rate limiter keys on req.ip. Behind a proxy that is the proxy's address unless Express
  // is told how many hops to trust, and then every client would share one limit.
  express.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  // Runs before Nest's own body parser, so the chat route gets its own size limit (413). The
  // wrapper matters: Nest skips its parser for every route if it finds one named "jsonParser".
  const parseAssistantBody = json({ limit: ASSISTANT_BODY_LIMIT });
  express.use(
    '/api/assistant',
    function assistantBodyParser(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      parseAssistantBody(req, res, next);
    },
  );
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
    // Lets the browser read the file name of an invoice PDF when the frontend is on another origin.
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new CheckoutValidationFilter(app.getHttpAdapter()));
  app.enableShutdownHooks();
}
