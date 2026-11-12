import { Column, Entity, PrimaryColumn } from 'typeorm';
import { PixTransferStatus } from '../../../../domain/enums/pix-transfer-status';
import { RiskDecision } from '../../../../domain/enums/risk-decision';
import { bigintTransformer } from './bigint.transformer';

@Entity({ name: 'pix_transfers', schema: 'payments' })
export class PixTransferEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'target_key', type: 'varchar', length: 255 })
  targetKey!: string;

  @Column({
    name: 'amount_cents',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  amountCents!: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, unique: true })
  idempotencyKey!: string;

  @Column({ type: 'enum', enum: PixTransferStatus, enumName: 'pix_status' })
  status!: PixTransferStatus;

  @Column({ name: 'risk_decision', type: 'enum', enum: RiskDecision, enumName: 'risk_decision' })
  riskDecision!: RiskDecision;

  @Column({ name: 'risk_score', type: 'int' })
  riskScore!: number;

  @Column({ name: 'risk_reason', type: 'varchar', length: 255 })
  riskReason!: string;

  @Column({ name: 'baas_transfer_id', type: 'varchar', length: 100, nullable: true })
  baasTransferId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
