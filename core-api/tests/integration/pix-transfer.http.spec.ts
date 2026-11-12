import pino from 'pino';
import request from 'supertest';
import { ApproveReviewedTransferUseCase } from '../../src/application/use-cases/approve-reviewed-transfer';
import { CreateCustomerUseCase } from '../../src/application/use-cases/create-customer';
import { DepositFundsUseCase } from '../../src/application/use-cases/deposit-funds';
import { GetAccountBalanceUseCase } from '../../src/application/use-cases/get-account-balance';
import { GetAccountStatementUseCase } from '../../src/application/use-cases/get-account-statement';
import { GetPixTransferUseCase } from '../../src/application/use-cases/get-pix-transfer';
import { ListPendingTransfersUseCase } from '../../src/application/use-cases/list-pending-transfers';
import { ProcessPixTransferUseCase } from '../../src/application/use-cases/process-pix-transfer';
import { RejectReviewedTransferUseCase } from '../../src/application/use-cases/reject-reviewed-transfer';
import { loadEnv } from '../../src/config/env';
import { createApp } from '../../src/infrastructure/http/app';
import { MockBaasPaymentRail } from '../../src/infrastructure/payment-rail/mock-baas-payment-rail';
import { LocalRiskEngine } from '../../src/infrastructure/risk/local-risk-engine';
import { NodePiiProtection } from '../../src/infrastructure/security/node-pii-protection';
import { InMemoryUnitOfWork } from '../support/in-memory-unit-of-work';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const CLEARING_ACCOUNT_NUMBER = 'CLEARING-0001';
const ADMIN_API_KEY = 'test_admin_key';
const PII_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function buildApp(balanceCents = 10_000) {
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    PII_HMAC_KEY: 'test_hmac_key_with_minimum_length',
    PII_ENCRYPTION_KEY,
    ADMIN_API_KEY,
    ENABLE_SANDBOX_ENDPOINTS: 'true',
    CLEARING_ACCOUNT_NUMBER,
  });

  const unitOfWork = new InMemoryUnitOfWork();
  unitOfWork.seedCustomerWithBalance({
    customerId: CUSTOMER_ID,
    accountId: ACCOUNT_ID,
    accountNumber: '123456789012',
    balanceCents,
  });
  unitOfWork.seedClearingAccount({
    accountNumber: CLEARING_ACCOUNT_NUMBER,
    balanceCents: 1_000_000_000,
  });

  const piiProtection = new NodePiiProtection(env.PII_HMAC_KEY, env.PII_ENCRYPTION_KEY);
  const paymentRail = new MockBaasPaymentRail();
  const riskEngine = new LocalRiskEngine(500_000, 1_000_000);

  const app = createApp({
    env,
    logger: pino({ level: 'silent' }),
    createCustomer: new CreateCustomerUseCase(unitOfWork, piiProtection),
    getAccountBalance: new GetAccountBalanceUseCase(unitOfWork),
    getAccountStatement: new GetAccountStatementUseCase(unitOfWork),
    processPixTransfer: new ProcessPixTransferUseCase(
      unitOfWork,
      riskEngine,
      paymentRail,
      CLEARING_ACCOUNT_NUMBER,
    ),
    getPixTransfer: new GetPixTransferUseCase(unitOfWork),
    listPendingTransfers: new ListPendingTransfersUseCase(unitOfWork),
    approveReviewedTransfer: new ApproveReviewedTransferUseCase(
      unitOfWork,
      paymentRail,
      CLEARING_ACCOUNT_NUMBER,
    ),
    rejectReviewedTransfer: new RejectReviewedTransferUseCase(unitOfWork),
    depositFunds: new DepositFundsUseCase(unitOfWork, CLEARING_ACCOUNT_NUMBER),
  });

  return { app, unitOfWork };
}

const transferBody = {
  accountId: ACCOUNT_ID,
  targetKey: 'destinatario@example.com',
  amountCents: 5_000,
};

describe('PIX transfer HTTP contract', () => {
  it('retorna 202 e deduz o saldo em transferência válida', async () => {
    const { app } = buildApp(10_000);

    const response = await request(app)
      .post('/pix/transfers')
      .set('Idempotency-Key', '123-abc')
      .send(transferBody);

    expect(response.status).toBe(202);
    expect(response.body.status).toBe('SETTLED');
    expect(response.body.availableBalanceCents).toBe(5_000);
    expect(response.body.idempotencyKey).toBe('123-abc');
  });

  it('retorna 422 com "Saldo insuficiente"', async () => {
    const { app } = buildApp(2_000);

    const response = await request(app)
      .post('/pix/transfers')
      .set('Idempotency-Key', 'saldo-insuficiente')
      .send(transferBody);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(response.body.error.message).toBe('Saldo insuficiente');
  });

  it('retorna 409 ao repetir a mesma Idempotency-Key', async () => {
    const { app } = buildApp(10_000);

    await request(app)
      .post('/pix/transfers')
      .set('Idempotency-Key', '123-abc')
      .send(transferBody)
      .expect(202);

    const response = await request(app)
      .post('/pix/transfers')
      .set('Idempotency-Key', '123-abc')
      .send(transferBody);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_IDEMPOTENCY_KEY');
  });

  it('retorna 400 quando Idempotency-Key não é enviada', async () => {
    const { app } = buildApp();

    const response = await request(app).post('/pix/transfers').send(transferBody);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('retorna 403 quando o motor antifraude bloqueia a operação', async () => {
    const { app } = buildApp(2_000_000);

    const response = await request(app)
      .post('/pix/transfers')
      .set('Idempotency-Key', 'bloqueada')
      .send({ ...transferBody, amountCents: 1_000_000 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RISK_BLOCKED');
  });

  it('permite consultar a transferência criada', async () => {
    const { app } = buildApp();

    const created = await request(app)
      .post('/pix/transfers')
      .set('Idempotency-Key', 'consulta')
      .send(transferBody);

    const response = await request(app).get(`/pix/transfers/${created.body.transferId}`);

    expect(response.status).toBe(200);
    expect(response.body.transferId).toBe(created.body.transferId);
    expect(response.body.status).toBe('SETTLED');
  });

  it('expõe a fila de compliance protegida por chave administrativa', async () => {
    const { app } = buildApp(1_000_000);

    const created = await request(app)
      .post('/pix/transfers')
      .set('Idempotency-Key', 'revisao-http')
      .send({ ...transferBody, amountCents: 500_000 });

    expect(created.status).toBe(202);
    expect(created.body.status).toBe('PENDING_REVIEW');

    await request(app).get('/compliance/pix/transfers/pending').expect(401);

    const pending = await request(app)
      .get('/compliance/pix/transfers/pending')
      .set('x-admin-api-key', ADMIN_API_KEY);

    expect(pending.status).toBe(200);
    expect(pending.body.total).toBe(1);

    const approved = await request(app)
      .post(`/compliance/pix/transfers/${created.body.transferId}/approve`)
      .set('x-admin-api-key', ADMIN_API_KEY);

    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('SETTLED');
    expect(approved.body.availableBalanceCents).toBe(500_000);
  });

  it('credita saldo pelo endpoint sandbox de forma idempotente', async () => {
    const { app } = buildApp(0);

    const deposit = await request(app)
      .post('/sandbox/deposits')
      .set('Idempotency-Key', 'deposito-1')
      .send({ accountId: ACCOUNT_ID, amountCents: 10_000 });

    expect(deposit.status).toBe(201);
    expect(deposit.body.availableBalanceCents).toBe(10_000);

    const duplicate = await request(app)
      .post('/sandbox/deposits')
      .set('Idempotency-Key', 'deposito-1')
      .send({ accountId: ACCOUNT_ID, amountCents: 10_000 });

    expect(duplicate.status).toBe(409);
  });

  it('expõe o contrato OpenAPI e o health check', async () => {
    const { app } = buildApp();

    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const docs = await request(app).get('/api-docs.json');
    expect(docs.status).toBe(200);
    expect(docs.body.info.title).toBe('Aurora Pay Core API');
    expect(docs.body.paths['/pix/transfers'].post).toBeDefined();
  });
});
