import { PixTransferStatus } from '../../domain/enums/pix-transfer-status';
import { AppError, NotFoundError } from '../../domain/errors/app-error';
import type { UnitOfWork } from '../ports/unit-of-work';
import { toPixTransferOutput, type PixTransferOutput } from './pix-transfer-output';

export interface RejectReviewedTransferInput {
  transferId: string;
}

export class RejectReviewedTransferUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(input: RejectReviewedTransferInput): Promise<PixTransferOutput> {
    return this.unitOfWork.execute(async (context) => {
      const transfer = await context.transferRepository.findByIdForUpdate(input.transferId);
      if (!transfer) {
        throw new NotFoundError('Transferência não encontrada', 'TRANSFER_NOT_FOUND');
      }
      if (transfer.status !== PixTransferStatus.PENDING_REVIEW) {
        throw new AppError(
          409,
          'Transferência não está pendente de revisão',
          'TRANSFER_NOT_IN_REVIEW',
        );
      }

      transfer.markRejected();
      await context.transferRepository.save(transfer);

      return toPixTransferOutput(transfer);
    });
  }
}
