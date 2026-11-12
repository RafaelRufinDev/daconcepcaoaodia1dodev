import type { EntityManager } from 'typeorm';
import type {
  LedgerPostingView,
  LedgerRepository,
} from '../../../../application/ports/ledger-repository';
import type {
  PaginatedResult,
  PaginationInput,
} from '../../../../application/ports/pix-transfer-repository';
import type { JournalEntry } from '../../../../domain/entities/journal-entry';
import { DuplicateIdempotencyKeyError } from '../../../../domain/errors/app-error';
import { JournalEntryEntity } from '../entities/journal-entry.entity';
import { PostingEntity } from '../entities/posting.entity';
import { isUniqueViolation } from '../is-unique-violation';
import {
  toJournalEntryDomain,
  toJournalEntryPersistence,
  toPostingPersistence,
} from '../mappers/journal-entry.mapper';

interface RawPostingRow {
  posting_id: string;
  entry_id: string;
  account_id: string;
  signed_amount_cents: string | number;
  reference_type: string;
  reference_id: string;
  created_at: Date | string;
}

export class TypeOrmLedgerRepository implements LedgerRepository {
  constructor(private readonly manager: EntityManager) {}

  async append(entry: JournalEntry): Promise<void> {
    try {
      await this.manager.getRepository(JournalEntryEntity).save(toJournalEntryPersistence(entry));

      await this.manager
        .getRepository(PostingEntity)
        .save(entry.postings.map(toPostingPersistence));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateIdempotencyKeyError();
      }
      throw error;
    }
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<JournalEntry | null> {
    const entry = await this.manager
      .getRepository(JournalEntryEntity)
      .findOne({ where: { idempotencyKey } });

    if (!entry) {
      return null;
    }

    const postings = await this.manager
      .getRepository(PostingEntity)
      .find({ where: { entryId: entry.id }, order: { createdAt: 'ASC' } });

    return toJournalEntryDomain(entry, postings);
  }

  async listByAccount(
    accountId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<LedgerPostingView>> {
    const postings = this.manager.getRepository(PostingEntity);

    const rows = await postings
      .createQueryBuilder('p')
      .innerJoin(JournalEntryEntity, 'e', 'e.id = p.entry_id')
      .select('p.id', 'posting_id')
      .addSelect('p.entry_id', 'entry_id')
      .addSelect('p.account_id', 'account_id')
      .addSelect('p.signed_amount_cents', 'signed_amount_cents')
      .addSelect('e.reference_type', 'reference_type')
      .addSelect('e.reference_id', 'reference_id')
      .addSelect('p.created_at', 'created_at')
      .where('p.account_id = :accountId', { accountId })
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .offset(pagination.offset)
      .limit(pagination.limit)
      .getRawMany<RawPostingRow>();

    const total = await postings
      .createQueryBuilder('p')
      .where('p.account_id = :accountId', { accountId })
      .getCount();

    return {
      items: rows.map((row) => ({
        postingId: row.posting_id,
        entryId: row.entry_id,
        accountId: row.account_id,
        signedAmountCents: Number(row.signed_amount_cents),
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      })),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }
}
