import type { Request } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../../../domain/errors/app-error';

export function parseBody<S extends z.ZodTypeAny>(schema: S, request: Request): z.infer<S> {
  const result = schema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError('Dados da requisição inválidos', result.error.flatten());
  }

  return result.data as z.infer<S>;
}

export function parseQuery<S extends z.ZodTypeAny>(schema: S, request: Request): z.infer<S> {
  const result = schema.safeParse(request.query);

  if (!result.success) {
    throw new ValidationError('Parâmetros da requisição inválidos', result.error.flatten());
  }

  return result.data as z.infer<S>;
}

export function parseParams<S extends z.ZodTypeAny>(schema: S, request: Request): z.infer<S> {
  const result = schema.safeParse(request.params);

  if (!result.success) {
    throw new ValidationError('Parâmetros de rota inválidos', result.error.flatten());
  }

  return result.data as z.infer<S>;
}
