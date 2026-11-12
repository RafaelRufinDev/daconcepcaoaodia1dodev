import { NotFoundError } from '../../domain/errors/app-error';
import type { UnitOfWork } from '../ports/unit-of-work';

export interface GetAccountBalanceInput {
  customerId: string;
}

export interface GetAccountBalanceOutput {
  accountId: string;
  customerId: string;
  accountNumber: string;
  currency: string;
  availableBalanceCents: number;
}

export class GetAccountBalanceUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(input: GetAccountBalanceInput): Promise<GetAccountBalanceOutput> {
    return this.unitOfWork.execute(async (context) => {
      const account = await context.accountRepository.findByCustomerId(input.customerId);
      if (!account) {
        throw new NotFoundError(
          'Conta não encontrada para o cliente informado',
          'ACCOUNT_NOT_FOUND',
        );
      }

      return {
        accountId: account.id,
        customerId: account.customerId,
        accountNumber: account.accountNumber,
        currency: account.currency,
        availableBalanceCents: account.availableBalanceCents,
      };
    });
  }
}
