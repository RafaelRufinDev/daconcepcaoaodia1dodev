import { PixTransfer } from '../../../../domain/entities/pix-transfer';
import type { PixTransferEntity } from '../entities/pix-transfer.entity';

export function toPixTransferDomain(entity: PixTransferEntity): PixTransfer {
  return PixTransfer.restore({
    id: entity.id,
    accountId: entity.accountId,
    targetKey: entity.targetKey,
    amountCents: entity.amountCents,
    idempotencyKey: entity.idempotencyKey,
    status: entity.status,
    riskDecision: entity.riskDecision,
    riskScore: entity.riskScore,
    riskReason: entity.riskReason,
    baasTransferId: entity.baasTransferId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}

export function toPixTransferPersistence(transfer: PixTransfer): PixTransferEntity {
  return {
    id: transfer.id,
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
  } as PixTransferEntity;
}
