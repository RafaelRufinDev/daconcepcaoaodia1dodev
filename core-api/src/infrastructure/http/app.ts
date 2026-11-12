import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { resolve } from 'node:path';
import type { Env } from '../../config/env';
import type { ApproveReviewedTransferUseCase } from '../../application/use-cases/approve-reviewed-transfer';
import type { CreateCustomerUseCase } from '../../application/use-cases/create-customer';
import type { DepositFundsUseCase } from '../../application/use-cases/deposit-funds';
import type { GetAccountBalanceUseCase } from '../../application/use-cases/get-account-balance';
import type { GetAccountStatementUseCase } from '../../application/use-cases/get-account-statement';
import type { GetPixTransferUseCase } from '../../application/use-cases/get-pix-transfer';
import type { ListPendingTransfersUseCase } from '../../application/use-cases/list-pending-transfers';
import type { ProcessPixTransferUseCase } from '../../application/use-cases/process-pix-transfer';
import type { RejectReviewedTransferUseCase } from '../../application/use-cases/reject-reviewed-transfer';
import type { Logger } from '../logging/logger';
import { openApiDocument } from './docs/openapi';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { createComplianceRouter } from './routes/compliance.routes';
import { createCustomerRouter } from './routes/customer.routes';
import { createPixTransferRouter } from './routes/pix-transfer.routes';
import { createSandboxRouter } from './routes/sandbox.routes';

export interface AppDependencies {
  env: Env;
  logger: Logger;
  createCustomer: CreateCustomerUseCase;
  getAccountBalance: GetAccountBalanceUseCase;
  getAccountStatement: GetAccountStatementUseCase;
  processPixTransfer: ProcessPixTransferUseCase;
  getPixTransfer: GetPixTransferUseCase;
  listPendingTransfers: ListPendingTransfersUseCase;
  approveReviewedTransfer: ApproveReviewedTransferUseCase;
  rejectReviewedTransfer: RejectReviewedTransferUseCase;
  depositFunds: DepositFundsUseCase;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin:
        dependencies.env.CORS_ORIGIN === '*'
          ? true
          : dependencies.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware(dependencies.logger));
  app.use(express.static(resolve(process.cwd(), 'public')));

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Aurora Pay Core API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );
  app.get('/api-docs.json', (_request, response) => {
    response.status(200).json(openApiDocument);
  });

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Limite de requisições por minuto excedido',
        },
      },
    }),
  );

  const apiRouter = express.Router();

  apiRouter.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'aurora-pay-core-api',
      timestamp: new Date().toISOString(),
    });
  });

  apiRouter.use(
    createCustomerRouter({
      createCustomer: dependencies.createCustomer,
      getAccountBalance: dependencies.getAccountBalance,
      getAccountStatement: dependencies.getAccountStatement,
    }),
  );
  apiRouter.use(
    createPixTransferRouter({
      processPixTransfer: dependencies.processPixTransfer,
      getPixTransfer: dependencies.getPixTransfer,
    }),
  );
  apiRouter.use(
    createComplianceRouter({
      adminApiKey: dependencies.env.ADMIN_API_KEY,
      listPendingTransfers: dependencies.listPendingTransfers,
      approveReviewedTransfer: dependencies.approveReviewedTransfer,
      rejectReviewedTransfer: dependencies.rejectReviewedTransfer,
    }),
  );

  if (dependencies.env.ENABLE_SANDBOX_ENDPOINTS) {
    apiRouter.use(
      createSandboxRouter({
        depositFunds: dependencies.depositFunds,
      }),
    );
  }

  app.use('/', apiRouter);
  app.use('/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler(dependencies.logger));

  return app;
}
