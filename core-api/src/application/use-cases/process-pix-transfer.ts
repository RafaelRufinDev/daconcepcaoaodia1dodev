import { randomUUID } from 'node:crypto';
import { JournalEntry } from '../../domain/entities/journal-entry';
import { PixTransfer } from '../../domain/entities/pix-transfer';
import { RiskAssessment } from '../../domain/entities/risk-assessment';
import { RiskDecision } from '../../domain/enums/risk-decision';
import {
  AppError,
  DuplicateIdempotencyKeyError,
  NotFoundError,
  RiskBlockedError,
  ValidationError,
} from '../../domain/errors/app-error';
import type { PaymentRail } from '../ports/payment-rail';
import type { RiskEngine, RiskEngineResult } from '../ports/risk-engine';
import type { TransactionContext, UnitOfWork } from '../ports/unit-of-work';
import { settlePixTransfer } from '../services/settle-pix-transfer';
import { toPixTransferOutput, type PixTransferOutput } from './pix-transfer-output';

export interface ProcessPixTransferInput {
  accountId: string;
  targetKey: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface ProcessPixTransferOutput {
  transfer: PixTransferOutput;
  availableBalanceCents: number;
}

const MAX_TRANSFER_AMOUNT_CENTS = 100_000_000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

export class ProcessPixTransferUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly riskEngine: RiskEngine,
    private readonly paymentRail: PaymentRail,
    private readonly clearingAccountNumber: string,
  ) {}

  async execute(input: ProcessPixTransferInput): Promise<ProcessPixTransferOutput> {
    const targetKey = input.targetKey.trim();
    const idempotencyKey = input.idempotencyKey.trim();

    this.validate(input, targetKey, idempotencyKey);

    const preloaded = await this.unitOfWork.execute(async (context) => {
      const existing = await context.transferRepository.findByIdempotencyKey(idempotencyKey);
      const account = await context.accountRepository.findById(input.accountId);

      return { existing, account };
    });

    if (preloaded.existing) {
      throw new DuplicateIdempotencyKeyError();
    }
    if (!preloaded.account) {
      throw new NotFoundError('Conta de origem não encontrada', 'ACCOUNT_NOT_FOUND');
    }

    const risk = await this.riskEngine.assess({
      accountId: preloaded.account.id,
      customerId: preloaded.account.customerId,
      targetKey,
      amountCents: input.amountCents,
      idempotencyKey,
    });

    if (risk.decision === RiskDecision.BLOCK || risk.decision === RiskDecision.CHALLENGE) {
      await this.persistBlockedAssessment(input, targetKey, idempotencyKey, risk);

      throw new RiskBlockedError(
        risk.decision === RiskDecision.CHALLENGE
          ? 'Transação requer autenticação adicional'
          : 'Transação bloqueada por políticas de segurança',
      );
    }

    if (risk.decision === RiskDecision.REVIEW) {
      const transfer = await this.unitOfWork.execute(async (context) => {
        await this.assertNotDuplicated(context, idempotencyKey);

        const reviewedTransfer = PixTransfer.createForReview({
          id: randomUUID(),
          accountId: input.accountId,
          targetKey,
          amountCents: input.amountCents,
          idempotencyKey,
          riskDecision: risk.decision,
          riskScore: risk.score,
          riskReason: risk.reason,
        });

        await context.transferRepository.save(reviewedTransfer);
        await context.riskAssessmentRepository.save(
          RiskAssessment.create({
            id: randomUUID(),
            transferId: reviewedTransfer.id,
            accountId: input.accountId,
            idempotencyKey,
            targetKey,
            amountCents: input.amountCents,
            score: risk.score,
            decision: risk.decision,
            reason: risk.reason,
          }),
        );

        return reviewedTransfer;
      });

      return {
        transfer: toPixTransferOutput(transfer),
        availableBalanceCents: preloaded.account.availableBalanceCents,
      };
    }

    const execution = await this.unitOfWork.execute(async (context) => {
      await this.assertNotDuplicated(context, idempotencyKey);

      const account = await context.accountRepository.findByIdForUpdate(input.accountId);
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
      if (account.id === clearingAccount.id) {
        throw new ValidationError('Conta de origem inválida');
      }

      account.debit(input.amountCents);
      clearingAccount.credit(input.amountCents);

      const transfer = PixTransfer.createForProcessing({
        id: randomUUID(),
        accountId: account.id,
        targetKey,
        amountCents: input.amountCents,
        idempotencyKey,
        riskDecision: risk.decision,
        riskScore: risk.score,
        riskReason: risk.reason,
      });

      await context.transferRepository.save(transfer);
      await context.accountRepository.save(account);
      await context.accountRepository.save(clearingAccount);

      await context.ledgerRepository.append(
        JournalEntry.create({
          idempotencyKey: `pix:${idempotencyKey}`,
          referenceType: 'PIX_TRANSFER',
          referenceId: transfer.id,
          postings: [
            { accountId: account.id, signedAmountCents: -input.amountCents },
            { accountId: clearingAccount.id, signedAmountCents: input.amountCents },
          ],
        }),
      );

      await context.riskAssessmentRepository.save(
        RiskAssessment.create({
          id: randomUUID(),
          transferId: transfer.id,
          accountId: account.id,
          idempotencyKey,
          targetKey,
          amountCents: input.amountCents,
          score: risk.score,
          decision: risk.decision,
          reason: risk.reason,
        }),
      );

      return {
        transfer,
        availableBalanceCents: account.availableBalanceCents,
      };
    });

    const settledTransfer = await settlePixTransfer(
      this.unitOfWork,
      this.paymentRail,
      execution.transfer,
    );

    return {
      transfer: toPixTransferOutput(settledTransfer),
      availableBalanceCents: execution.availableBalanceCents,
    };
  }

  private validate(
    input: ProcessPixTransferInput,
    targetKey: string,
    idempotencyKey: string,
  ): void {
    if (!idempotencyKey) {
      throw new ValidationError('O cabeçalho Idempotency-Key é obrigatório');
    }
    if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new ValidationError('Idempotency-Key excede o tamanho máximo de 100 caracteres');
    }
    if (!targetKey) {
      throw new ValidationError('A chave PIX de destino é obrigatória');
    }
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new ValidationError('O valor deve ser um inteiro positivo em centavos');
    }
    if (input.amountCents > MAX_TRANSFER_AMOUNT_CENTS) {
      throw new ValidationError('O valor máximo por transferência é R$ 1.000.000,00');
    }
  }

  private async assertNotDuplicated(
    context: TransactionContext,
    idempotencyKey: string,
  ): Promise<void> {
    const duplicated = await context.transferRepository.findByIdempotencyKey(idempotencyKey);
    if (duplicated) {
      throw new DuplicateIdempotencyKeyError();
    }
  }

  private async persistBlockedAssessment(
    input: ProcessPixTransferInput,
    targetKey: string,
    idempotencyKey: string,
    risk: RiskEngineResult,
  ): Promise<void> {
    await this.unitOfWork.execute(async (context) => {
      await context.riskAssessmentRepository.save(
        RiskAssessment.create({
          id: randomUUID(),
          transferId: null,
          accountId: input.accountId,
          idempotencyKey,
          targetKey,
          amountCents: input.amountCents,
          score: risk.score,
          decision: risk.decision,
          reason: risk.reason,
        }),
      );
    });
  }
}
