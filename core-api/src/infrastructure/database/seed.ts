import 'reflect-metadata';
import { CreateCustomerUseCase } from '../../application/use-cases/create-customer';
import type { CreateCustomerInput } from '../../application/use-cases/create-customer';
import { DepositFundsUseCase } from '../../application/use-cases/deposit-funds';
import { loadEnv } from '../../config/env';
import { AppError, DuplicateIdempotencyKeyError } from '../../domain/errors/app-error';
import { AppDataSource } from './typeorm/data-source';
import { TypeOrmUnitOfWork } from './typeorm/typeorm-unit-of-work';
import { NodePiiProtection } from '../security/node-pii-protection';

interface SeedCustomer {
  input: CreateCustomerInput;
  initialBalanceCents: number;
}

const seedCustomers: SeedCustomer[] = [
  {
    input: {
      fullName: 'João Silva',
      taxId: '52998224725',
      email: 'joao.silva@aurorapay.local',
      phone: '+5583999990001',
    },
    initialBalanceCents: 10_000,
  },
  {
    input: {
      fullName: 'Maria Oliveira',
      taxId: '11144477735',
      email: 'maria.oliveira@aurorapay.local',
      phone: '+5583999990002',
    },
    initialBalanceCents: 2_000,
  },
];

async function seed(): Promise<void> {
  const env = loadEnv();
  const piiProtection = new NodePiiProtection(env.PII_HMAC_KEY, env.PII_ENCRYPTION_KEY);

  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  const unitOfWork = new TypeOrmUnitOfWork(AppDataSource);
  const createCustomer = new CreateCustomerUseCase(unitOfWork, piiProtection);
  const depositFunds = new DepositFundsUseCase(unitOfWork, env.CLEARING_ACCOUNT_NUMBER);

  const results: Array<{
    customerId: string;
    accountId: string;
    accountNumber: string;
    availableBalanceCents: number;
  }> = [];

  for (const seedCustomer of seedCustomers) {
    const customer = await ensureCustomer(createCustomer, seedCustomer.input);

    try {
      await depositFunds.execute({
        accountId: customer.accountId,
        amountCents: seedCustomer.initialBalanceCents,
        idempotencyKey: `seed:${customer.accountId}`,
      });
    } catch (error) {
      if (!(error instanceof DuplicateIdempotencyKeyError)) {
        throw error;
      }
    }

    const balance = await unitOfWork.execute(async (context) => {
      const account = await context.accountRepository.findById(customer.accountId);
      return account?.availableBalanceCents ?? 0;
    });

    results.push({
      customerId: customer.customerId,
      accountId: customer.accountId,
      accountNumber: customer.accountNumber,
      availableBalanceCents: balance,
    });
  }

  process.stdout.write(`${JSON.stringify({ seeded: results }, null, 2)}\n`);

  await AppDataSource.destroy();
}

async function ensureCustomer(
  createCustomer: CreateCustomerUseCase,
  input: CreateCustomerInput,
): Promise<{ customerId: string; accountId: string; accountNumber: string }> {
  try {
    const created = await createCustomer.execute(input);
    return {
      customerId: created.customerId,
      accountId: created.accountId,
      accountNumber: created.accountNumber,
    };
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'CUSTOMER_ALREADY_EXISTS') {
      throw error;
    }

    const unitOfWork = new TypeOrmUnitOfWork(AppDataSource);
    const existing = await unitOfWork.execute(async (context) => {
      const customer = await context.customerRepository.findByEmail(
        input.email.trim().toLowerCase(),
      );
      const account = customer
        ? await context.accountRepository.findByCustomerId(customer.id)
        : null;

      return { customer, account };
    });

    if (!existing.customer || !existing.account) {
      throw error;
    }

    return {
      customerId: existing.customer.id,
      accountId: existing.account.id,
      accountNumber: existing.account.accountNumber,
    };
  }
}

seed().catch((error: unknown) => {
  process.stderr.write(`Falha ao executar o seed: ${String(error)}\n`);
  process.exit(1);
});
