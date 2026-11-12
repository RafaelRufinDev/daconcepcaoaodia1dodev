import { randomUUID } from 'node:crypto';
import { LedgerEntryStatus } from '../enums/ledger-entry-status';
import { ValidationError, LedgerImbalanceError } from '../errors/app-error';

export interface PostingProps {
  id: string;
  entryId: string;
  accountId: string;
  signedAmountCents: number;
  createdAt: Date;
}

export class Posting {
  private constructor(private readonly props: PostingProps) {}

  static create(entryId: string, accountId: string, signedAmountCents: number): Posting {
    if (!Number.isSafeInteger(signedAmountCents) || signedAmountCents === 0) {
      throw new ValidationError('O lançamento contábil não pode ter valor zero');
    }

    return new Posting({
      id: randomUUID(),
      entryId,
      accountId,
      signedAmountCents,
      createdAt: new Date(),
    });
  }

  static restore(props: PostingProps): Posting {
    return new Posting({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get entryId(): string {
    return this.props.entryId;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get signedAmountCents(): number {
    return this.props.signedAmountCents;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

export interface NewPosting {
  accountId: string;
  signedAmountCents: number;
}

export interface JournalEntryProps {
  id: string;
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  status: LedgerEntryStatus;
  reversalOf: string | null;
  createdAt: Date;
  postings: Posting[];
}

export class JournalEntry {
  private constructor(private readonly props: JournalEntryProps) {}

  static create(input: {
    idempotencyKey: string;
    referenceType: string;
    referenceId: string;
    postings: NewPosting[];
    reversalOf?: string | null;
  }): JournalEntry {
    if (input.postings.length < 2) {
      throw new ValidationError('Uma entrada contábil exige no mínimo dois lançamentos');
    }

    const entryId = randomUUID();
    const postings = input.postings.map((posting) =>
      Posting.create(entryId, posting.accountId, posting.signedAmountCents),
    );

    const total = postings.reduce((sum, posting) => sum + posting.signedAmountCents, 0);
    if (total !== 0) {
      throw new LedgerImbalanceError();
    }

    return new JournalEntry({
      id: entryId,
      idempotencyKey: input.idempotencyKey,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      status: LedgerEntryStatus.POSTED,
      reversalOf: input.reversalOf ?? null,
      createdAt: new Date(),
      postings,
    });
  }

  static restore(props: JournalEntryProps): JournalEntry {
    return new JournalEntry({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get referenceType(): string {
    return this.props.referenceType;
  }

  get referenceId(): string {
    return this.props.referenceId;
  }

  get status(): LedgerEntryStatus {
    return this.props.status;
  }

  get reversalOf(): string | null {
    return this.props.reversalOf;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get postings(): readonly Posting[] {
    return this.props.postings;
  }
}
