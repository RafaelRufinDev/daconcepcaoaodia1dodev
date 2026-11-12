import type { RiskAssessment } from '../../../../domain/entities/risk-assessment';
import type { RiskAssessmentEntity } from '../entities/risk-assessment.entity';

export function toRiskAssessmentPersistence(assessment: RiskAssessment): RiskAssessmentEntity {
  return {
    id: assessment.id,
    transferId: assessment.transferId,
    accountId: assessment.accountId,
    idempotencyKey: assessment.idempotencyKey,
    targetKey: assessment.targetKey,
    amountCents: assessment.amountCents,
    score: assessment.score,
    decision: assessment.decision,
    reason: assessment.reason,
    createdAt: assessment.createdAt,
  } as RiskAssessmentEntity;
}
