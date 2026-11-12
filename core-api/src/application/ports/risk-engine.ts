import type { RiskDecision } from '../../domain/enums/risk-decision';

export interface RiskEngineInput {
  accountId: string;
  customerId: string;
  targetKey: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface RiskEngineResult {
  decision: RiskDecision;
  score: number;
  reason: string;
}

export interface RiskEngine {
  assess(input: RiskEngineInput): Promise<RiskEngineResult>;
}
