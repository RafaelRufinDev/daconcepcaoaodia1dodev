import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { RiskDecision } from '../../../../domain/enums/risk-decision';
import { bigintTransformer } from './bigint.transformer';

@Entity({ name: 'assessments', schema: 'risk' })
export class RiskAssessmentEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'transfer_id', type: 'uuid', nullable: true })
  transferId!: string | null;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey!: string;

  @Column({ name: 'target_key', type: 'varchar', length: 255 })
  targetKey!: string;

  @Column({ name: 'amount_cents', type: 'bigint', transformer: bigintTransformer })
  amountCents!: number;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'enum', enum: RiskDecision, enumName: 'risk_decision' })
  decision!: RiskDecision;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
