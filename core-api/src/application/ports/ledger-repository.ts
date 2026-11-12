import type { JournalEntry } from '../../domain/entities/journal-entry';
import type { PaginatedResult, PaginationInput } from './pix-transfer-repository';

export interface LedgerPostingView {
  postingId: string;
  entryId: string;
  accountId: string;
  signedAmountCents: number;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
}

export interface LedgerRepository {
  append(entry: JournalEntry): Promise<void>;
  findByIdempotencyKey(idempotencyKey: string): Promise<JournalEntry | null>;
  listByAccount(
    accountId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<LedgerPostingView>>;
}
