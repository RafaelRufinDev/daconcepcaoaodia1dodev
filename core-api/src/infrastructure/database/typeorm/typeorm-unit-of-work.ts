import type { DataSource } from 'typeorm';
import type { TransactionContext, UnitOfWork } from '../../../application/ports/unit-of-work';
import { TypeOrmAccountRepository } from './repositories/typeorm-account.repository';
import { TypeOrmCustomerRepository } from './repositories/typeorm-customer.repository';
import { TypeOrmLedgerRepository } from './repositories/typeorm-ledger.repository';
import { TypeOrmPixTransferRepository } from './repositories/typeorm-pix-transfer.repository';
import { TypeOrmRiskAssessmentRepository } from './repositories/typeorm-risk-assessment.repository';

export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        accountRepository: new TypeOrmAccountRepository(manager),
        customerRepository: new TypeOrmCustomerRepository(manager),
        transferRepository: new TypeOrmPixTransferRepository(manager),
        ledgerRepository: new TypeOrmLedgerRepository(manager),
        riskAssessmentRepository: new TypeOrmRiskAssessmentRepository(manager),
      }),
    );
  }
}
