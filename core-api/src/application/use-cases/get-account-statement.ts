import { NotFoundError } from '../../domain/errors/app-error';
import type { UnitOfWork } from '../ports/unit-of-work';

export interface GetAccountStatementInput {
  customerId: string;
  limit: number;
  offset: number;
}

export interface StatementItem {
  postingId: string;
  entryId: string;
  signedAmountCents: number;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
}

export interface GetAccountStatementOutput {
  accountId: string;
  availableBalanceCents: number;
  items: StatementItem[];
  total: number;
  limit: number;
  offset: number;
}

export class GetAccountStatementUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(input: GetAccountStatementInput): Promise<GetAccountStatementOutput> {
    return this.unitOfWork.execute(async (context) => {
      const account = await context.accountRepository.findByCustomerId(input.customerId);
      if (!account) {
        throw new NotFoundError(
          'Conta não encontrada para o cliente informado',
          'ACCOUNT_NOT_FOUND',
        );
      }

      const result = await context.ledgerRepository.listByAccount(account.id, {
        limit: input.limit,
        offset: input.offset,
      });

      return {
        accountId: account.id,
        availableBalanceCents: account.availableBalanceCents,
        items: result.items.map((item) => ({
          postingId: item.postingId,
          entryId: item.entryId,
          signedAmountCents: item.signedAmountCents,
          referenceType: item.referenceType,
          referenceId: item.referenceId,
          createdAt: item.createdAt,
        })),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      };
    });
  }
}
