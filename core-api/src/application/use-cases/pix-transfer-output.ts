import type { PixTransfer } from '../../domain/entities/pix-transfer';
import type { PixTransferStatus } from '../../domain/enums/pix-transfer-status';
import type { RiskDecision } from '../../domain/enums/risk-decision';

export interface PixTransferOutput {
  transferId: string;
  accountId: string;
  targetKey: string;
  amountCents: number;
  idempotencyKey: string;
  status: PixTransferStatus;
  riskDecision: RiskDecision;
  riskScore: number;
  riskReason: string;
  baasTransferId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPixTransferOutput(transfer: PixTransfer): PixTransferOutput {
  return {
    transferId: transfer.id,
    accountId: transfer.accountId,
    targetKey: transfer.targetKey,
    amountCents: transfer.amountCents,
    idempotencyKey: transfer.idempotencyKey,
    status: transfer.status,
    riskDecision: transfer.riskDecision,
    riskScore: transfer.riskScore,
    riskReason: transfer.riskReason,
    baasTransferId: transfer.baasTransferId,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
  };
}
