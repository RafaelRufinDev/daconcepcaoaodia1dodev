import type {
  RiskEngine,
  RiskEngineInput,
  RiskEngineResult,
} from '../../application/ports/risk-engine';
import { RiskDecision } from '../../domain/enums/risk-decision';

export class LocalRiskEngine implements RiskEngine {
  constructor(
    private readonly reviewThresholdCents: number,
    private readonly blockThresholdCents: number,
  ) {}

  async assess(input: RiskEngineInput): Promise<RiskEngineResult> {
    if (input.amountCents >= this.blockThresholdCents) {
      return {
        decision: RiskDecision.BLOCK,
        score: 95,
        reason: 'Valor acima do limite máximo de segurança',
      };
    }

    if (input.amountCents >= this.reviewThresholdCents) {
      return {
        decision: RiskDecision.REVIEW,
        score: 70,
        reason: 'Valor acima do limite de revisão manual',
      };
    }

    return {
      decision: RiskDecision.APPROVE,
      score: 10,
      reason: 'Transação dentro dos parâmetros de risco',
    };
  }
}
