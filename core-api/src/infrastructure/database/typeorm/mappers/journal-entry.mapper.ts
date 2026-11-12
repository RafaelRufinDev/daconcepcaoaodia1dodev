import { JournalEntry, Posting } from '../../../../domain/entities/journal-entry';
import type { JournalEntryEntity } from '../entities/journal-entry.entity';
import type { PostingEntity } from '../entities/posting.entity';

export function toJournalEntryDomain(
  entry: JournalEntryEntity,
  postings: PostingEntity[],
): JournalEntry {
  return JournalEntry.restore({
    id: entry.id,
    idempotencyKey: entry.idempotencyKey,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    status: entry.status,
    reversalOf: entry.reversalOf,
    createdAt: entry.createdAt,
    postings: postings.map((posting) =>
      Posting.restore({
        id: posting.id,
        entryId: posting.entryId,
        accountId: posting.accountId,
        signedAmountCents: posting.signedAmountCents,
        createdAt: posting.createdAt,
      }),
    ),
  });
}

export function toJournalEntryPersistence(entry: JournalEntry): JournalEntryEntity {
  return {
    id: entry.id,
    idempotencyKey: entry.idempotencyKey,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    status: entry.status,
    reversalOf: entry.reversalOf,
    createdAt: entry.createdAt,
  } as JournalEntryEntity;
}

export function toPostingPersistence(posting: Posting): PostingEntity {
  return {
    id: posting.id,
    entryId: posting.entryId,
    accountId: posting.accountId,
    signedAmountCents: posting.signedAmountCents,
    createdAt: posting.createdAt,
  } as PostingEntity;
}
