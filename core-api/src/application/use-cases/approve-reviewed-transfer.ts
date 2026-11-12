import { JournalEntry } from '../../domain/entities/journal-entry';
import { PixTransferStatus } from '../../domain/enums/pix-transfer-status';
import { AppError, NotFoundError } from '../../domain/errors/app-error';
import type { PaymentRail } from '../ports/payment-rail';
import type { UnitOfWork } from '../ports/unit-of-work';
import { settlePixTransfer } from '../services/settle-pix-transfer';
import { toPixTransferOutput, type PixTransferOutput } from './pix-transfer-output';

export interface ApproveReviewedTransferInput {
  transferId: string;
}

export interface ApproveReviewedTransferOutput {
  transfer: PixTransferOutput;
  availableBalanceCents: number;
}

export class ApproveReviewedTransferUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly paymentRail: PaymentRail,
    private readonly clearingAccountNumber: string,
  ) {}

  async execute(input: ApproveReviewedTransferInput): Promise<ApproveReviewedTransferOutput> {
    const execution = await this.unitOfWork.execute(async (context) => {
      const transfer = await context.transferRepository.findByIdForUpdate(input.transferId);
      if (!transfer) {
        throw new NotFoundError('Transferência não encontrada', 'TRANSFER_NOT_FOUND');
      }
      if (transfer.status !== PixTransferStatus.PENDING_REVIEW) {
        throw new AppError(
          409,
          'Transferência não está pendente de revisão',
          'TRANSFER_NOT_IN_REVIEW',
        );
      }

      const account = await context.accountRepository.findByIdForUpdate(transfer.accountId);
      if (!account) {
        throw new NotFoundError('Conta de origem não encontrada', 'ACCOUNT_NOT_FOUND');
      }

      const clearingAccount = await context.accountRepository.findByAccountNumberForUpdate(
        this.clearingAccountNumber,
      );
      if (!clearingAccount) {
        throw new AppError(
          500,
          'Conta contábil interna não configurada',
          'CLEARING_ACCOUNT_NOT_CONFIGURED',
        );
      }

      account.debit(transfer.amountCents);
      clearingAccount.credit(transfer.amountCents);

      await context.accountRepository.save(account);
      await context.accountRepository.save(clearingAccount);
      await context.ledgerRepository.append(
        JournalEntry.create({
          idempotencyKey: `pix:${transfer.idempotencyKey}`,
          referenceType: 'PIX_TRANSFER',
          referenceId: transfer.id,
          postings: [
            { accountId: account.id, signedAmountCents: -transfer.amountCents },
            { accountId: clearingAccount.id, signedAmountCents: transfer.amountCents },
          ],
        }),
      );

      return {
        transfer,
        availableBalanceCents: account.availableBalanceCents,
      };
    });

    const settled = await settlePixTransfer(this.unitOfWork, this.paymentRail, execution.transfer);

    return {
      transfer: toPixTransferOutput(settled),
      availableBalanceCents: execution.availableBalanceCents,
    };
  }
}
