import { NotFoundError } from '../../domain/errors/app-error';
import type { UnitOfWork } from '../ports/unit-of-work';
import { toPixTransferOutput, type PixTransferOutput } from './pix-transfer-output';

export interface GetPixTransferInput {
  transferId: string;
}

export class GetPixTransferUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(input: GetPixTransferInput): Promise<PixTransferOutput> {
    return this.unitOfWork.execute(async (context) => {
      const transfer = await context.transferRepository.findById(input.transferId);
      if (!transfer) {
        throw new NotFoundError('Transferência não encontrada', 'TRANSFER_NOT_FOUND');
      }

      return toPixTransferOutput(transfer);
    });
  }
}
