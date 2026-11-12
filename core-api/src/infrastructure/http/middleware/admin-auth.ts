import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../../domain/errors/app-error';

export function adminAuthMiddleware(adminApiKey: string) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const provided = request.header('x-admin-api-key');

    if (!provided || !safeCompare(provided, adminApiKey)) {
      next(new UnauthorizedError());
      return;
    }

    next();
  };
}

function safeCompare(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}
