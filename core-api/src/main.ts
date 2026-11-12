import 'reflect-metadata';
import { loadEnv } from './config/env';
import { ApproveReviewedTransferUseCase } from './application/use-cases/approve-reviewed-transfer';
import { CreateCustomerUseCase } from './application/use-cases/create-customer';
import { DepositFundsUseCase } from './application/use-cases/deposit-funds';
import { GetAccountBalanceUseCase } from './application/use-cases/get-account-balance';
import { GetAccountStatementUseCase } from './application/use-cases/get-account-statement';
import { GetPixTransferUseCase } from './application/use-cases/get-pix-transfer';
import { ListPendingTransfersUseCase } from './application/use-cases/list-pending-transfers';
import { ProcessPixTransferUseCase } from './application/use-cases/process-pix-transfer';
import { RejectReviewedTransferUseCase } from './application/use-cases/reject-reviewed-transfer';
import { AppDataSource } from './infrastructure/database/typeorm/data-source';
import { TypeOrmUnitOfWork } from './infrastructure/database/typeorm/typeorm-unit-of-work';
import { createApp } from './infrastructure/http/app';
import { createLogger } from './infrastructure/logging/logger';
import { MockBaasPaymentRail } from './infrastructure/payment-rail/mock-baas-payment-rail';
import { FallbackRiskEngine, HttpRiskEngine } from './infrastructure/risk/http-risk-engine';
import { LocalRiskEngine } from './infrastructure/risk/local-risk-engine';
import { NodePiiProtection } from './infrastructure/security/node-pii-protection';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  await AppDataSource.initialize();
  logger.info('Conectado ao PostgreSQL');

  const unitOfWork = new TypeOrmUnitOfWork(AppDataSource);
  const piiProtection = new NodePiiProtection(env.PII_HMAC_KEY, env.PII_ENCRYPTION_KEY);
  const paymentRail = new MockBaasPaymentRail();
  const localRiskEngine = new LocalRiskEngine(
    env.RISK_REVIEW_THRESHOLD_CENTS,
    env.RISK_BLOCK_THRESHOLD_CENTS,
  );

  if (env.RISK_ENGINE === 'http' && !env.ANTI_FRAUD_SERVICE_URL) {
    throw new Error('RISK_ENGINE=http exige a variável ANTI_FRAUD_SERVICE_URL');
  }

  const riskEngine =
    env.RISK_ENGINE === 'http' && env.ANTI_FRAUD_SERVICE_URL
      ? new FallbackRiskEngine(new HttpRiskEngine(env.ANTI_FRAUD_SERVICE_URL), localRiskEngine)
      : localRiskEngine;

  const app = createApp({
    env,
    logger,
    createCustomer: new CreateCustomerUseCase(unitOfWork, piiProtection),
    getAccountBalance: new GetAccountBalanceUseCase(unitOfWork),
    getAccountStatement: new GetAccountStatementUseCase(unitOfWork),
    processPixTransfer: new ProcessPixTransferUseCase(
      unitOfWork,
      riskEngine,
      paymentRail,
      env.CLEARING_ACCOUNT_NUMBER,
    ),
    getPixTransfer: new GetPixTransferUseCase(unitOfWork),
    listPendingTransfers: new ListPendingTransfersUseCase(unitOfWork),
    approveReviewedTransfer: new ApproveReviewedTransferUseCase(
      unitOfWork,
      paymentRail,
      env.CLEARING_ACCOUNT_NUMBER,
    ),
    rejectReviewedTransfer: new RejectReviewedTransferUseCase(unitOfWork),
    depositFunds: new DepositFundsUseCase(unitOfWork, env.CLEARING_ACCOUNT_NUMBER),
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Aurora Pay Core API iniciada');
    logger.info(`Swagger disponível em http://localhost:${env.PORT}/api-docs`);
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Encerrando aplicação');

    server.close(() => {
      void AppDataSource.destroy()
        .then(() => {
          logger.info('Conexão com o banco encerrada');
          process.exit(0);
        })
        .catch((error: unknown) => {
          logger.error({ error }, 'Erro ao encerrar a conexão com o banco');
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  const logger = createLogger({ LOG_LEVEL: 'error', NODE_ENV: 'production' });
  logger.error({ error }, 'Falha ao iniciar a aplicação');
  process.exit(1);
});
