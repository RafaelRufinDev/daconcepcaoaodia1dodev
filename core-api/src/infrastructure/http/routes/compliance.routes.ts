import { Router } from 'express';
import type { ApproveReviewedTransferUseCase } from '../../../application/use-cases/approve-reviewed-transfer';
import type { ListPendingTransfersUseCase } from '../../../application/use-cases/list-pending-transfers';
import type { RejectReviewedTransferUseCase } from '../../../application/use-cases/reject-reviewed-transfer';
import { adminAuthMiddleware } from '../middleware/admin-auth';
import { asyncHandler } from '../middleware/async-handler';
import { paginationQuerySchema, transferIdParamSchema } from '../schemas';
import { parseParams, parseQuery } from '../validation/parse';

export interface ComplianceRoutesDependencies {
  adminApiKey: string;
  listPendingTransfers: ListPendingTransfersUseCase;
  approveReviewedTransfer: ApproveReviewedTransferUseCase;
  rejectReviewedTransfer: RejectReviewedTransferUseCase;
}

export function createComplianceRouter(dependencies: ComplianceRoutesDependencies): Router {
  const router = Router();

  router.use('/compliance', adminAuthMiddleware(dependencies.adminApiKey));

  router.get(
    '/compliance/pix/transfers/pending',
    asyncHandler(async (request, response) => {
      const { limit, offset } = parseQuery(paginationQuerySchema, request);
      const result = await dependencies.listPendingTransfers.execute({ limit, offset });

      response.status(200).json(result);
    }),
  );

  router.post(
    '/compliance/pix/transfers/:transferId/approve',
    asyncHandler(async (request, response) => {
      const { transferId } = parseParams(transferIdParamSchema, request);
      const result = await dependencies.approveReviewedTransfer.execute({ transferId });

      response.status(200).json({
        ...result.transfer,
        availableBalanceCents: result.availableBalanceCents,
      });
    }),
  );

  router.post(
    '/compliance/pix/transfers/:transferId/reject',
    asyncHandler(async (request, response) => {
      const { transferId } = parseParams(transferIdParamSchema, request);
      const result = await dependencies.rejectReviewedTransfer.execute({ transferId });

      response.status(200).json(result);
    }),
  );

  return router;
}
