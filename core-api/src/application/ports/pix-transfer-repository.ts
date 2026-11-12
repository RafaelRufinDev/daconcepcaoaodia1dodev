import type { PixTransfer } from '../../domain/entities/pix-transfer';
import type { PixTransferStatus } from '../../domain/enums/pix-transfer-status';

export interface PaginationInput {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PixTransferRepository {
  findById(id: string): Promise<PixTransfer | null>;
  findByIdForUpdate(id: string): Promise<PixTransfer | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<PixTransfer | null>;
  save(transfer: PixTransfer): Promise<void>;
  listByAccount(
    accountId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<PixTransfer>>;
  listByStatus(
    status: PixTransferStatus,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<PixTransfer>>;
}
