import type { EntityManager } from 'typeorm';
import type { RiskAssessmentRepository } from '../../../../application/ports/risk-assessment-repository';
import type { RiskAssessment } from '../../../../domain/entities/risk-assessment';
import { RiskAssessmentEntity } from '../entities/risk-assessment.entity';
import { toRiskAssessmentPersistence } from '../mappers/risk-assessment.mapper';

export class TypeOrmRiskAssessmentRepository implements RiskAssessmentRepository {
  constructor(private readonly manager: EntityManager) {}

  async save(assessment: RiskAssessment): Promise<void> {
    await this.manager
      .getRepository(RiskAssessmentEntity)
      .save(toRiskAssessmentPersistence(assessment));
  }
}
