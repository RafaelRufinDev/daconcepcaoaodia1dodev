import { Router } from 'express';
import type { DepositFundsUseCase } from '../../../application/use-cases/deposit-funds';
import { asyncHandler } from '../middleware/async-handler';
import { requireIdempotencyKey } from '../middleware/headers';
import { depositBodySchema } from '../schemas';
import { parseBody } from '../validation/parse';

export interface SandboxRoutesDependencies {
  depositFunds: DepositFundsUseCase;
}

export function createSandboxRouter(dependencies: SandboxRoutesDependencies): Router {
  const router = Router();

  router.post(
    '/sandbox/deposits',
    asyncHandler(async (request, response) => {
      const body = parseBody(depositBodySchema, request);
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await dependencies.depositFunds.execute({
        ...body,
        idempotencyKey,
      });

      response.status(201).json(result);
    }),
  );

  return router;
}
