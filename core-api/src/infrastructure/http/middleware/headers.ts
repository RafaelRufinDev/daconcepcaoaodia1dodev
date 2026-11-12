import type { Request } from 'express';
import { ValidationError } from '../../../domain/errors/app-error';

export function requireIdempotencyKey(request: Request): string {
  const header = request.header('idempotency-key')?.trim();

  if (!header) {
    throw new ValidationError('O cabeçalho Idempotency-Key é obrigatório');
  }

  return header;
}
