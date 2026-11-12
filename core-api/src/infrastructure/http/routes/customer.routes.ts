import { Router } from 'express';
import type { CreateCustomerUseCase } from '../../../application/use-cases/create-customer';
import type { GetAccountBalanceUseCase } from '../../../application/use-cases/get-account-balance';
import type { GetAccountStatementUseCase } from '../../../application/use-cases/get-account-statement';
import { asyncHandler } from '../middleware/async-handler';
import { customerIdParamSchema, createCustomerBodySchema, paginationQuerySchema } from '../schemas';
import { parseBody, parseParams, parseQuery } from '../validation/parse';

export interface CustomerRoutesDependencies {
  createCustomer: CreateCustomerUseCase;
  getAccountBalance: GetAccountBalanceUseCase;
  getAccountStatement: GetAccountStatementUseCase;
}

export function createCustomerRouter(dependencies: CustomerRoutesDependencies): Router {
  const router = Router();

  router.post(
    '/customers',
    asyncHandler(async (request, response) => {
      const body = parseBody(createCustomerBodySchema, request);
      const result = await dependencies.createCustomer.execute(body);

      response.status(201).json(result);
    }),
  );

  router.get(
    '/customers/:customerId/balance',
    asyncHandler(async (request, response) => {
      const { customerId } = parseParams(customerIdParamSchema, request);
      const result = await dependencies.getAccountBalance.execute({ customerId });

      response.status(200).json(result);
    }),
  );

  router.get(
    '/customers/:customerId/statement',
    asyncHandler(async (request, response) => {
      const { customerId } = parseParams(customerIdParamSchema, request);
      const { limit, offset } = parseQuery(paginationQuerySchema, request);
      const result = await dependencies.getAccountStatement.execute({
        customerId,
        limit,
        offset,
      });

      response.status(200).json(result);
    }),
  );

  return router;
}
