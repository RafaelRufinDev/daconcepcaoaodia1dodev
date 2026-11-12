import { PixTransferStatus } from '../../domain/enums/pix-transfer-status';
import type { UnitOfWork } from '../ports/unit-of-work';
import { toPixTransferOutput, type PixTransferOutput } from './pix-transfer-output';

export interface ListPendingTransfersInput {
  limit: number;
  offset: number;
}

export interface ListPendingTransfersOutput {
  items: PixTransferOutput[];
  total: number;
  limit: number;
  offset: number;
}

export class ListPendingTransfersUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(input: ListPendingTransfersInput): Promise<ListPendingTransfersOutput> {
    const result = await this.unitOfWork.execute((context) =>
      context.transferRepository.listByStatus(PixTransferStatus.PENDING_REVIEW, {
        limit: input.limit,
        offset: input.offset,
      }),
    );

    return {
      items: result.items.map(toPixTransferOutput),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }
}
