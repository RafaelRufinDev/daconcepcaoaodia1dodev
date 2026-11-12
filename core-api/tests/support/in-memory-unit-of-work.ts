import type { AccountRepository } from '../../src/application/ports/account-repository';
import type { CustomerRepository } from '../../src/application/ports/customer-repository';
import type {
  LedgerPostingView,
  LedgerRepository,
} from '../../src/application/ports/ledger-repository';
import type {
  PaginatedResult,
  PaginationInput,
  PixTransferRepository,
} from '../../src/application/ports/pix-transfer-repository';
import type { RiskAssessmentRepository } from '../../src/application/ports/risk-assessment-repository';
import type { TransactionContext, UnitOfWork } from '../../src/application/ports/unit-of-work';
import { Account } from '../../src/domain/entities/account';
import { Customer } from '../../src/domain/entities/customer';
import type { JournalEntry } from '../../src/domain/entities/journal-entry';
import type { PixTransfer } from '../../src/domain/entities/pix-transfer';
import type { RiskAssessment } from '../../src/domain/entities/risk-assessment';
import { CustomerStatus } from '../../src/domain/enums/customer-status';
import type { PixTransferStatus } from '../../src/domain/enums/pix-transfer-status';
import { DuplicateIdempotencyKeyError } from '../../src/domain/errors/app-error';

export class InMemoryUnitOfWork implements UnitOfWork {
  readonly accounts = new Map<string, Account>();
  readonly customers = new Map<string, Customer>();
  readonly transfers = new Map<string, PixTransfer>();
  readonly transfersByIdempotencyKey = new Map<string, string>();
  readonly journalEntries = new Map<string, JournalEntry>();
  readonly journalEntriesByIdempotencyKey = new Map<string, string>();
  readonly riskAssessments = new Map<string, RiskAssessment>();

  async execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return work({
      accountRepository: this.accountRepository,
      customerRepository: this.customerRepository,
      transferRepository: this.transferRepository,
      ledgerRepository: this.ledgerRepository,
      riskAssessmentRepository: this.riskAssessmentRepository,
    });
  }

  seedCustomer(customer: Customer): void {
    this.customers.set(customer.id, customer);
  }

  seedAccount(account: Account): void {
    this.accounts.set(account.id, account);
  }

  seedCustomerWithBalance(input: {
    customerId: string;
    accountId: string;
    accountNumber: string;
    balanceCents: number;
  }): Account {
    this.seedCustomer(
      createCustomer({
        id: input.customerId,
        email: `${input.customerId}@example.com`,
      }),
    );

    const account = Account.restore({
      id: input.accountId,
      customerId: input.customerId,
      accountNumber: input.accountNumber,
      currency: 'BRL',
      availableBalanceCents: input.balanceCents,
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    this.seedAccount(account);
    return account;
  }

  seedClearingAccount(input: { accountNumber: string; balanceCents: number }): Account {
    const customerId = '00000000-0000-4000-8000-000000000001';
    if (!this.customers.has(customerId)) {
      this.seedCustomer(createCustomer({ id: customerId, email: 'clearing@example.com' }));
    }

    const account = Account.restore({
      id: '00000000-0000-4000-8000-000000000002',
      customerId,
      accountNumber: input.accountNumber,
      currency: 'BRL',
      availableBalanceCents: input.balanceCents,
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    this.seedAccount(account);
    return account;
  }

  private readonly accountRepository: AccountRepository = {
    findById: async (id) => this.accounts.get(id) ?? null,
    findByIdForUpdate: async (id) => this.accounts.get(id) ?? null,
    findByCustomerId: async (customerId) =>
      Array.from(this.accounts.values()).find((account) => account.customerId === customerId) ??
      null,
    findByAccountNumberForUpdate: async (accountNumber) =>
      Array.from(this.accounts.values()).find(
        (account) => account.accountNumber === accountNumber,
      ) ?? null,
    save: async (account) => {
      this.accounts.set(account.id, account);
    },
  };

  private readonly customerRepository: CustomerRepository = {
    findById: async (id) => this.customers.get(id) ?? null,
    findByEmail: async (emailNormalized) =>
      Array.from(this.customers.values()).find(
        (customer) => customer.emailNormalized === emailNormalized,
      ) ?? null,
    findByTaxIdHash: async (taxIdHash) =>
      Array.from(this.customers.values()).find((customer) => customer.taxIdHash === taxIdHash) ??
      null,
    save: async (customer) => {
      this.customers.set(customer.id, customer);
    },
  };

  private readonly transferRepository: PixTransferRepository = {
    findById: async (id) => this.transfers.get(id) ?? null,
    findByIdForUpdate: async (id) => this.transfers.get(id) ?? null,
    findByIdempotencyKey: async (idempotencyKey) => {
      const id = this.transfersByIdempotencyKey.get(idempotencyKey);
      return id ? (this.transfers.get(id) ?? null) : null;
    },
    save: async (transfer) => {
      const existingId = this.transfersByIdempotencyKey.get(transfer.idempotencyKey);
      if (existingId && existingId !== transfer.id) {
        throw new DuplicateIdempotencyKeyError();
      }

      this.transfers.set(transfer.id, transfer);
      this.transfersByIdempotencyKey.set(transfer.idempotencyKey, transfer.id);
    },
    listByAccount: async (accountId, pagination) =>
      paginate(
        Array.from(this.transfers.values()).filter((transfer) => transfer.accountId === accountId),
        pagination,
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      ),
    listByStatus: async (status, pagination) =>
      paginate(
        Array.from(this.transfers.values()).filter((transfer) => transfer.status === status),
        pagination,
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      ),
  };

  private readonly ledgerRepository: LedgerRepository = {
    append: async (entry) => {
      const existingId = this.journalEntriesByIdempotencyKey.get(entry.idempotencyKey);
      if (existingId && existingId !== entry.id) {
        throw new DuplicateIdempotencyKeyError();
      }

      this.journalEntries.set(entry.id, entry);
      this.journalEntriesByIdempotencyKey.set(entry.idempotencyKey, entry.id);
    },
    findByIdempotencyKey: async (idempotencyKey) => {
      const id = this.journalEntriesByIdempotencyKey.get(idempotencyKey);
      return id ? (this.journalEntries.get(id) ?? null) : null;
    },
    listByAccount: async (accountId, pagination) => {
      const items: LedgerPostingView[] = [];

      for (const entry of this.journalEntries.values()) {
        for (const posting of entry.postings) {
          if (posting.accountId === accountId) {
            items.push({
              postingId: posting.id,
              entryId: entry.id,
              accountId: posting.accountId,
              signedAmountCents: posting.signedAmountCents,
              referenceType: entry.referenceType,
              referenceId: entry.referenceId,
              createdAt: posting.createdAt,
            });
          }
        }
      }

      items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      const paginated = items.slice(pagination.offset, pagination.offset + pagination.limit);

      return {
        items: paginated,
        total: items.length,
        limit: pagination.limit,
        offset: pagination.offset,
      };
    },
  };

  private readonly riskAssessmentRepository: RiskAssessmentRepository = {
    save: async (assessment) => {
      this.riskAssessments.set(assessment.id, assessment);
    },
  };

  getTransferStatus(transferId: string): PixTransferStatus | undefined {
    return this.transfers.get(transferId)?.status;
  }
}

function paginate<T>(
  items: T[],
  pagination: PaginationInput,
  sorter: (left: T, right: T) => number,
): PaginatedResult<T> {
  const sorted = [...items].sort(sorter);
  return {
    items: sorted.slice(pagination.offset, pagination.offset + pagination.limit),
    total: sorted.length,
    limit: pagination.limit,
    offset: pagination.offset,
  };
}

function createCustomer(input: { id: string; email: string }): Customer {
  return Customer.restore({
    id: input.id,
    fullName: 'Test Customer',
    taxIdHash: 'a'.repeat(64),
    emailNormalized: input.email,
    phoneEncrypted: Buffer.from('encrypted'),
    keycloakUserId: null,
    status: CustomerStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}
