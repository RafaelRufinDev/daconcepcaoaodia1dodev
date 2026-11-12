import type { Account } from '../../domain/entities/account';

export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  findByIdForUpdate(id: string): Promise<Account | null>;
  findByCustomerId(customerId: string): Promise<Account | null>;
  findByAccountNumberForUpdate(accountNumber: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
}
