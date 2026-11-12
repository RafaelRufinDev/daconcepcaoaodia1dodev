import { CreateCustomerUseCase } from '../../src/application/use-cases/create-customer';
import { DepositFundsUseCase } from '../../src/application/use-cases/deposit-funds';
import { GetAccountBalanceUseCase } from '../../src/application/use-cases/get-account-balance';
import { GetAccountStatementUseCase } from '../../src/application/use-cases/get-account-statement';
import { CustomerStatus } from '../../src/domain/enums/customer-status';
import {
  AppError,
  DuplicateIdempotencyKeyError,
  InsufficientFundsError,
  ValidationError,
} from '../../src/domain/errors/app-error';
import { NodePiiProtection } from '../../src/infrastructure/security/node-pii-protection';
import { InMemoryUnitOfWork } from '../support/in-memory-unit-of-work';

const CLEARING_ACCOUNT_NUMBER = 'CLEARING-0001';

function createSut(): {
  unitOfWork: InMemoryUnitOfWork;
  createCustomer: CreateCustomerUseCase;
  depositFunds: DepositFundsUseCase;
  getBalance: GetAccountBalanceUseCase;
  getStatement: GetAccountStatementUseCase;
} {
  const unitOfWork = new InMemoryUnitOfWork();
  const piiProtection = new NodePiiProtection(
    'test_hmac_key_with_minimum_length',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  );

  return {
    unitOfWork,
    createCustomer: new CreateCustomerUseCase(unitOfWork, piiProtection),
    depositFunds: new DepositFundsUseCase(unitOfWork, CLEARING_ACCOUNT_NUMBER),
    getBalance: new GetAccountBalanceUseCase(unitOfWork),
    getStatement: new GetAccountStatementUseCase(unitOfWork),
  };
}

function seedFundedAccount(
  unitOfWork: InMemoryUnitOfWork,
  balanceCents = 10_000,
): {
  customerId: string;
  accountId: string;
} {
  const customerId = '22222222-2222-4222-8222-222222222222';
  const accountId = '11111111-1111-4111-8111-111111111111';

  unitOfWork.seedCustomerWithBalance({
    customerId,
    accountId,
    accountNumber: '123456789012',
    balanceCents,
  });
  unitOfWork.seedClearingAccount({
    accountNumber: CLEARING_ACCOUNT_NUMBER,
    balanceCents: 1_000_000_000,
  });

  return { customerId, accountId };
}

describe('Fluxos de cliente e conta', () => {
  it('cria cliente ativo, protege PII e abre conta zerada', async () => {
    const sut = createSut();

    const result = await sut.createCustomer.execute({
      fullName: 'Ana Teste',
      taxId: '52998224725',
      email: 'ANA@EXAMPLE.COM',
      phone: '11999998888',
    });

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    const customer = sut.unitOfWork.customers.get(result.customerId);
    expect(customer?.emailNormalized).toBe('ana@example.com');
    expect(customer?.taxIdHash).toHaveLength(64);
    expect(customer?.taxIdHash).not.toContain('52998224725');
    expect(customer?.phoneEncrypted.toString()).not.toContain('11999998888');
    expect(sut.unitOfWork.accounts.get(result.accountId)?.availableBalanceCents).toBe(0);
  });

  it('rejeita CPF inválido', async () => {
    const sut = createSut();

    await expect(
      sut.createCustomer.execute({
        fullName: 'Ana Teste',
        taxId: '11111111111',
        email: 'ana@example.com',
        phone: '11999998888',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita CPF duplicado', async () => {
    const sut = createSut();
    const input = {
      fullName: 'Ana Teste',
      taxId: '52998224725',
      email: 'ana@example.com',
      phone: '11999998888',
    };

    await sut.createCustomer.execute(input);

    await expect(
      sut.createCustomer.execute({ ...input, email: 'outra@example.com' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CUSTOMER_ALREADY_EXISTS' });
  });

  it('rejeita e-mail duplicado', async () => {
    const sut = createSut();

    await sut.createCustomer.execute({
      fullName: 'Ana Teste',
      taxId: '52998224725',
      email: 'ana@example.com',
      phone: '11999998888',
    });

    await expect(
      sut.createCustomer.execute({
        fullName: 'Bruno Teste',
        taxId: '39053344705',
        email: 'ana@example.com',
        phone: '11999998888',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CUSTOMER_ALREADY_EXISTS' });
  });

  it('consulta saldo do cliente', async () => {
    const sut = createSut();
    const { customerId, accountId } = seedFundedAccount(sut.unitOfWork, 12_345);

    const result = await sut.getBalance.execute({ customerId });

    expect(result).toEqual({
      accountId,
      customerId,
      accountNumber: '123456789012',
      currency: 'BRL',
      availableBalanceCents: 12_345,
    });
  });

  it('retorna 404 quando a conta do cliente não existe', async () => {
    const sut = createSut();

    await expect(
      sut.getBalance.execute({ customerId: '00000000-0000-4000-8000-000000000099' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ACCOUNT_NOT_FOUND' });

    await expect(
      sut.getStatement.execute({
        customerId: '00000000-0000-4000-8000-000000000099',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ACCOUNT_NOT_FOUND' });
  });

  it('credita depósito sandbox e registra lançamento balanceado', async () => {
    const sut = createSut();
    const { customerId, accountId } = seedFundedAccount(sut.unitOfWork, 0);

    const result = await sut.depositFunds.execute({
      accountId,
      amountCents: 15_000,
      idempotencyKey: 'deposito-1',
    });

    expect(result.availableBalanceCents).toBe(15_000);
    expect(sut.unitOfWork.accounts.get(accountId)?.availableBalanceCents).toBe(15_000);
    expect(sut.unitOfWork.accounts.get(accountId)?.version).toBe(2);

    const statement = await sut.getStatement.execute({ customerId, limit: 20, offset: 0 });
    expect(statement.items).toHaveLength(1);
    expect(statement.items[0]?.signedAmountCents).toBe(15_000);
    expect(statement.items[0]?.referenceType).toBe('SANDBOX_DEPOSIT');
    expect(statement.total).toBe(1);
  });

  it('não repete depósito com a mesma Idempotency-Key', async () => {
    const sut = createSut();
    const { accountId } = seedFundedAccount(sut.unitOfWork, 0);
    const input = { accountId, amountCents: 1_000, idempotencyKey: 'deposito-repetido' };

    await sut.depositFunds.execute(input);

    await expect(sut.depositFunds.execute(input)).rejects.toBeInstanceOf(
      DuplicateIdempotencyKeyError,
    );
  });

  it('valida valor, chave de idempotência e conta de depósito', async () => {
    const sut = createSut();

    await expect(
      sut.depositFunds.execute({
        accountId: '11111111-1111-4111-8111-111111111111',
        amountCents: 1_000,
        idempotencyKey: ' ',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      sut.depositFunds.execute({
        accountId: '11111111-1111-4111-8111-111111111111',
        amountCents: 0,
        idempotencyKey: 'valor-invalido',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      sut.depositFunds.execute({
        accountId: '11111111-1111-4111-8111-111111111111',
        amountCents: 1_000,
        idempotencyKey: 'conta-inexistente',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ACCOUNT_NOT_FOUND' });
  });

  it('rejeita depósito na própria conta contábil interna', async () => {
    const sut = createSut();
    const clearing = sut.unitOfWork.seedClearingAccount({
      accountNumber: CLEARING_ACCOUNT_NUMBER,
      balanceCents: 1_000_000,
    });

    await expect(
      sut.depositFunds.execute({
        accountId: clearing.id,
        amountCents: 1_000,
        idempotencyKey: 'conta-interna',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita depósito sem conta contábil interna configurada', async () => {
    const sut = createSut();
    const { accountId } = seedFundedAccount(sut.unitOfWork, 0);
    sut.unitOfWork.accounts.delete('00000000-0000-4000-8000-000000000002');

    await expect(
      sut.depositFunds.execute({
        accountId,
        amountCents: 1_000,
        idempotencyKey: 'sem-clearing',
      }),
    ).rejects.toMatchObject({ statusCode: 500, code: 'CLEARING_ACCOUNT_NOT_CONFIGURED' });
  });

  it('impede depósito que deixaria a conta contábil sem saldo', async () => {
    const sut = createSut();
    const { accountId } = seedFundedAccount(sut.unitOfWork, 0);
    const clearing = sut.unitOfWork.accounts.get('00000000-0000-4000-8000-000000000002');
    if (!clearing) {
      throw new Error('Conta clearing não encontrada');
    }
    clearing.debit(clearing.availableBalanceCents);

    await expect(
      sut.depositFunds.execute({
        accountId,
        amountCents: 1_000,
        idempotencyKey: 'clearing-sem-saldo',
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
  });

  it('lista extrato paginado em ordem decrescente', async () => {
    const sut = createSut();
    const { customerId, accountId } = seedFundedAccount(sut.unitOfWork, 0);

    await sut.depositFunds.execute({
      accountId,
      amountCents: 1_000,
      idempotencyKey: 'extrato-1',
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await sut.depositFunds.execute({
      accountId,
      amountCents: 2_000,
      idempotencyKey: 'extrato-2',
    });

    const firstPage = await sut.getStatement.execute({ customerId, limit: 1, offset: 0 });
    const secondPage = await sut.getStatement.execute({ customerId, limit: 1, offset: 1 });

    expect(firstPage.items.map((item) => item.signedAmountCents)).toEqual([2_000]);
    expect(secondPage.items.map((item) => item.signedAmountCents)).toEqual([1_000]);
    expect(firstPage.total).toBe(2);
    expect(firstPage.limit).toBe(1);
    expect(secondPage.offset).toBe(1);
  });

  it('mapeia erros de conflito com statusCode 409', () => {
    const error = new AppError(409, 'Conflito', 'CONFLICT');

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });
});
