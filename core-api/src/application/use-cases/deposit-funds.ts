import { JournalEntry } from '../../domain/entities/journal-entry';
import {
  AppError,
  DuplicateIdempotencyKeyError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors/app-error';
import type { UnitOfWork } from '../ports/unit-of-work';

export interface DepositFundsInput {
  accountId: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface DepositFundsOutput {
  accountId: string;
  entryId: string;
  availableBalanceCents: number;
}

export class DepositFundsUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clearingAccountNumber: string,
  ) {}

  async execute(input: DepositFundsInput): Promise<DepositFundsOutput> {
    const idempotencyKey = input.idempotencyKey.trim();

    if (!idempotencyKey) {
      throw new ValidationError('O cabeçalho Idempotency-Key é obrigatório');
    }
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new ValidationError('O valor deve ser um inteiro positivo em centavos');
    }

    return this.unitOfWork.execute(async (context) => {
      const existingEntry = await context.ledgerRepository.findByIdempotencyKey(
        `deposit:${idempotencyKey}`,
      );
      if (existingEntry) {
        throw new DuplicateIdempotencyKeyError();
      }

      const account = await context.accountRepository.findByIdForUpdate(input.accountId);
      if (!account) {
        throw new NotFoundError('Conta não encontrada', 'ACCOUNT_NOT_FOUND');
      }

      const clearingAccount = await context.accountRepository.findByAccountNumberForUpdate(
        this.clearingAccountNumber,
      );
      if (!clearingAccount) {
        throw new AppError(
          500,
          'Conta contábil interna não configurada',
          'CLEARING_ACCOUNT_NOT_CONFIGURED',
        );
      }
      if (account.id === clearingAccount.id) {
        throw new ValidationError('Conta de destino inválida');
      }

      clearingAccount.debit(input.amountCents);
      account.credit(input.amountCents);

      await context.accountRepository.save(clearingAccount);
      await context.accountRepository.save(account);

      const entry = JournalEntry.create({
        idempotencyKey: `deposit:${idempotencyKey}`,
        referenceType: 'SANDBOX_DEPOSIT',
        referenceId: account.id,
        postings: [
          { accountId: clearingAccount.id, signedAmountCents: -input.amountCents },
          { accountId: account.id, signedAmountCents: input.amountCents },
        ],
      });

      await context.ledgerRepository.append(entry);

      return {
        accountId: account.id,
        entryId: entry.id,
        availableBalanceCents: account.availableBalanceCents,
      };
    });
  }
}
