import { Account } from '../../../../domain/entities/account';
import type { AccountEntity } from '../entities/account.entity';

export function toAccountDomain(entity: AccountEntity): Account {
  return Account.restore({
    id: entity.id,
    customerId: entity.customerId,
    accountNumber: entity.accountNumber,
    currency: entity.currency,
    availableBalanceCents: entity.availableBalanceCents,
    version: entity.version,
    createdAt: entity.createdAt,
  });
}

export function toAccountPersistence(account: Account): AccountEntity {
  return {
    id: account.id,
    customerId: account.customerId,
    accountNumber: account.accountNumber,
    currency: account.currency,
    availableBalanceCents: account.availableBalanceCents,
    version: account.version,
    createdAt: account.createdAt,
  } as AccountEntity;
}
