import type { RiskAssessment } from '../../domain/entities/risk-assessment';

export interface RiskAssessmentRepository {
  save(assessment: RiskAssessment): Promise<void>;
}
