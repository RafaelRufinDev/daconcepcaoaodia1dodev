import { Router } from 'express';
import type { GetPixTransferUseCase } from '../../../application/use-cases/get-pix-transfer';
import type { ProcessPixTransferUseCase } from '../../../application/use-cases/process-pix-transfer';
import { asyncHandler } from '../middleware/async-handler';
import { requireIdempotencyKey } from '../middleware/headers';
import { pixTransferBodySchema, transferIdParamSchema } from '../schemas';
import { parseBody, parseParams } from '../validation/parse';

export interface PixTransferRoutesDependencies {
  processPixTransfer: ProcessPixTransferUseCase;
  getPixTransfer: GetPixTransferUseCase;
}

export function createPixTransferRouter(dependencies: PixTransferRoutesDependencies): Router {
  const router = Router();

  router.post(
    '/pix/transfers',
    asyncHandler(async (request, response) => {
      const body = parseBody(pixTransferBodySchema, request);
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await dependencies.processPixTransfer.execute({
        ...body,
        idempotencyKey,
      });

      response.status(202).json({
        ...result.transfer,
        availableBalanceCents: result.availableBalanceCents,
      });
    }),
  );

  router.get(
    '/pix/transfers/:transferId',
    asyncHandler(async (request, response) => {
      const { transferId } = parseParams(transferIdParamSchema, request);
      const result = await dependencies.getPixTransfer.execute({ transferId });

      response.status(200).json(result);
    }),
  );

  return router;
}
