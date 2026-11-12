export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciais administrativas inválidas') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = 'NOT_FOUND') {
    super(404, message, code);
  }
}

export class DuplicateIdempotencyKeyError extends AppError {
  constructor() {
    super(409, 'Requisição duplicada para a mesma Idempotency-Key', 'DUPLICATE_IDEMPOTENCY_KEY');
  }
}

export class InsufficientFundsError extends AppError {
  constructor() {
    super(422, 'Saldo insuficiente', 'INSUFFICIENT_FUNDS');
  }
}

export class RiskBlockedError extends AppError {
  constructor(reason = 'Transação bloqueada por políticas de segurança') {
    super(403, reason, 'RISK_BLOCKED');
  }
}

export class LedgerImbalanceError extends AppError {
  constructor() {
    super(
      500,
      'Violação da Contabilidade Dupla: a soma dos lançamentos deve ser ZERO',
      'LEDGER_IMBALANCE',
    );
  }
}
