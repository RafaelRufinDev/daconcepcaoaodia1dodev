import type { EntityManager } from 'typeorm';
import type { AccountRepository } from '../../../../application/ports/account-repository';
import type { Account } from '../../../../domain/entities/account';
import { AccountEntity } from '../entities/account.entity';
import { toAccountDomain, toAccountPersistence } from '../mappers/account.mapper';

export class TypeOrmAccountRepository implements AccountRepository {
  constructor(private readonly manager: EntityManager) {}

  async findById(id: string): Promise<Account | null> {
    const entity = await this.manager.getRepository(AccountEntity).findOne({ where: { id } });
    return entity ? toAccountDomain(entity) : null;
  }

  async findByIdForUpdate(id: string): Promise<Account | null> {
    const entity = await this.manager.getRepository(AccountEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return entity ? toAccountDomain(entity) : null;
  }

  async findByCustomerId(customerId: string): Promise<Account | null> {
    const entity = await this.manager
      .getRepository(AccountEntity)
      .findOne({ where: { customerId } });
    return entity ? toAccountDomain(entity) : null;
  }

  async findByAccountNumberForUpdate(accountNumber: string): Promise<Account | null> {
    const entity = await this.manager.getRepository(AccountEntity).findOne({
      where: { accountNumber },
      lock: { mode: 'pessimistic_write' },
    });
    return entity ? toAccountDomain(entity) : null;
  }

  async save(account: Account): Promise<void> {
    await this.manager.getRepository(AccountEntity).save(toAccountPersistence(account));
  }
}
