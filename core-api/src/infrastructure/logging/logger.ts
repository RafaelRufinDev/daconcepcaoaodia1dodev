import pino, { type Logger } from 'pino';
import type { Env } from '../../config/env';

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: {
      service: 'aurora-pay-core-api',
      environment: env.NODE_ENV,
    },
    redact: {
      paths: ['req.headers.authorization', 'req.headers["x-admin-api-key"]', 'req.body.taxId'],
      censor: '[REDACTED]',
    },
  });
}

export type { Logger };
