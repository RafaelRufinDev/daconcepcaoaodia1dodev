import type { PixTransfer } from '../../domain/entities/pix-transfer';
import { NotFoundError } from '../../domain/errors/app-error';
import type { PaymentRail, PaymentRailResult } from '../ports/payment-rail';
import type { UnitOfWork } from '../ports/unit-of-work';

export async function settlePixTransfer(
  unitOfWork: UnitOfWork,
  paymentRail: PaymentRail,
  transfer: PixTransfer,
): Promise<PixTransfer> {
  let receipt: PaymentRailResult;

  try {
    receipt = await paymentRail.send({
      transferId: transfer.id,
      accountId: transfer.accountId,
      targetKey: transfer.targetKey,
      amountCents: transfer.amountCents,
      idempotencyKey: transfer.idempotencyKey,
    });
  } catch {
    return updateTransfer(unitOfWork, transfer.id, (persisted) => persisted.markInDoubt());
  }

  return updateTransfer(unitOfWork, transfer.id, (persisted) =>
    persisted.markSettled(receipt.baasTransferId),
  );
}

async function updateTransfer(
  unitOfWork: UnitOfWork,
  transferId: string,
  mutate: (transfer: PixTransfer) => void,
): Promise<PixTransfer> {
  return unitOfWork.execute(async (context) => {
    const persisted = await context.transferRepository.findByIdForUpdate(transferId);
    if (!persisted) {
      throw new NotFoundError('Transferência não encontrada', 'TRANSFER_NOT_FOUND');
    }

    mutate(persisted);
    await context.transferRepository.save(persisted);
    return persisted;
  });
}
