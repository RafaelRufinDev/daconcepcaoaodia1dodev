import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../../domain/errors/app-error';
import type { Logger } from '../../logging/logger';

export function errorHandler(logger: Logger) {
  return (error: unknown, request: Request, response: Response, _next: NextFunction): void => {
    if (response.headersSent) {
      _next(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        correlationId: request.correlationId,
      });
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados da requisição inválidos',
          details: error.flatten(),
        },
        correlationId: request.correlationId,
      });
      return;
    }

    logger.error(
      {
        correlationId: request.correlationId,
        error: error instanceof Error ? error.stack : String(error),
      },
      'unhandled_error',
    );

    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
      },
      correlationId: request.correlationId,
    });
  };
}

export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Rota ${request.method} ${request.originalUrl} não encontrada`,
    },
    correlationId: request.correlationId,
  });
}
