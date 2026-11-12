import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../../logging/logger';

export function correlationIdMiddleware(logger: Logger) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const incoming = request.headers['x-correlation-id'];
    const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    const startedAt = Date.now();

    response.on('finish', () => {
      logger.info(
        {
          correlationId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        },
        'http_request',
      );
    });

    next();
  };
}
