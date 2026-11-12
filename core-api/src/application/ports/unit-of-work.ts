import type { AccountRepository } from './account-repository';
import type { CustomerRepository } from './customer-repository';
import type { LedgerRepository } from './ledger-repository';
import type { PixTransferRepository } from './pix-transfer-repository';
import type { RiskAssessmentRepository } from './risk-assessment-repository';

export interface TransactionContext {
  accountRepository: AccountRepository;
  customerRepository: CustomerRepository;
  transferRepository: PixTransferRepository;
  ledgerRepository: LedgerRepository;
  riskAssessmentRepository: RiskAssessmentRepository;
}

export interface UnitOfWork {
  execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}
