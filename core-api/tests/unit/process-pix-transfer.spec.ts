import { ApproveReviewedTransferUseCase } from '../../src/application/use-cases/approve-reviewed-transfer';
import { ProcessPixTransferUseCase } from '../../src/application/use-cases/process-pix-transfer';
import { RejectReviewedTransferUseCase } from '../../src/application/use-cases/reject-reviewed-transfer';
import { PixTransferStatus } from '../../src/domain/enums/pix-transfer-status';
import { RiskDecision } from '../../src/domain/enums/risk-decision';
import {
  DuplicateIdempotencyKeyError,
  RiskBlockedError,
  ValidationError,
} from '../../src/domain/errors/app-error';
import { LocalRiskEngine } from '../../src/infrastructure/risk/local-risk-engine';
import { InMemoryUnitOfWork } from '../support/in-memory-unit-of-work';
import { RecordingPaymentRail } from '../support/payment-rail';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const CLEARING_ACCOUNT_NUMBER = 'CLEARING-0001';

interface Sut {
  unitOfWork: InMemoryUnitOfWork;
  paymentRail: RecordingPaymentRail;
  processPixTransfer: ProcessPixTransferUseCase;
  approveReviewedTransfer: ApproveReviewedTransferUseCase;
  rejectReviewedTransfer: RejectReviewedTransferUseCase;
}

function createSut(balanceCents = 10_000): Sut {
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

  const paymentRail = new RecordingPaymentRail();
  const riskEngine = new LocalRiskEngine(500_000, 1_000_000);

  return {
    unitOfWork,
    paymentRail,
    processPixTransfer: new ProcessPixTransferUseCase(
      unitOfWork,
      riskEngine,
      paymentRail,
      CLEARING_ACCOUNT_NUMBER,
    ),
    approveReviewedTransfer: new ApproveReviewedTransferUseCase(
      unitOfWork,
      paymentRail,
      CLEARING_ACCOUNT_NUMBER,
    ),
    rejectReviewedTransfer: new RejectReviewedTransferUseCase(unitOfWork),
  };
}

describe('ProcessPixTransferUseCase', () => {
  it('processa transferência válida, debita o saldo e registra ledger balanceado', async () => {
    const sut = createSut(10_000);

    const result = await sut.processPixTransfer.execute({
      accountId: ACCOUNT_ID,
      targetKey: 'destinatario@example.com',
      amountCents: 5_000,
      idempotencyKey: '123-abc',
    });

    expect(result.transfer.status).toBe(PixTransferStatus.SETTLED);
    expect(result.transfer.riskDecision).toBe(RiskDecision.APPROVE);
    expect(result.availableBalanceCents).toBe(5_000);
    expect(sut.unitOfWork.accounts.get(ACCOUNT_ID)?.availableBalanceCents).toBe(5_000);
    expect(sut.paymentRail.calls).toHaveLength(1);

    const entry = Array.from(sut.unitOfWork.journalEntries.values())[0];
    expect(entry).toBeDefined();
    if (!entry) {
      throw new Error('Entrada contábil não encontrada');
    }

    expect(entry.postings).toHaveLength(2);
    expect(entry.postings.reduce((sum, posting) => sum + posting.signedAmountCents, 0)).toBe(0);
    expect(entry.postings.map((posting) => posting.signedAmountCents).sort()).toEqual([
      -5_000, 5_000,
    ]);
    expect(sut.unitOfWork.riskAssessments.size).toBe(1);
  });

  it('bloqueia transferência com saldo insuficiente e retorna HTTP 422', async () => {
    const sut = createSut(2_000);

    await expect(
      sut.processPixTransfer.execute({
        accountId: ACCOUNT_ID,
        targetKey: 'destinatario@example.com',
        amountCents: 5_000,
        idempotencyKey: 'saldo-insuficiente',
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: 'Saldo insuficiente',
      code: 'INSUFFICIENT_FUNDS',
    });

    expect(sut.unitOfWork.accounts.get(ACCOUNT_ID)?.availableBalanceCents).toBe(2_000);
    expect(sut.unitOfWork.transfers.size).toBe(0);
    expect(sut.unitOfWork.journalEntries.size).toBe(0);
    expect(sut.paymentRail.calls).toHaveLength(0);
  });

  it('não reprocessa uma Idempotency-Key já utilizada e retorna HTTP 409', async () => {
    const sut = createSut(10_000);
    const payload = {
      accountId: ACCOUNT_ID,
      targetKey: 'destinatario@example.com',
      amountCents: 5_000,
      idempotencyKey: '123-abc',
    };

    await sut.processPixTransfer.execute(payload);

    await expect(sut.processPixTransfer.execute(payload)).rejects.toBeInstanceOf(
      DuplicateIdempotencyKeyError,
    );

    expect(sut.unitOfWork.accounts.get(ACCOUNT_ID)?.availableBalanceCents).toBe(5_000);
    expect(sut.unitOfWork.transfers.size).toBe(1);
    expect(sut.unitOfWork.journalEntries.size).toBe(1);
    expect(sut.paymentRail.calls).toHaveLength(1);
  });

  it('bloqueia transação acima do limite antifraude sem movimentar saldo', async () => {
    const sut = createSut(2_000_000);

    await expect(
      sut.processPixTransfer.execute({
        accountId: ACCOUNT_ID,
        targetKey: 'destinatario@example.com',
        amountCents: 1_000_000,
        idempotencyKey: 'bloqueada',
      }),
    ).rejects.toBeInstanceOf(RiskBlockedError);

    expect(sut.unitOfWork.accounts.get(ACCOUNT_ID)?.availableBalanceCents).toBe(2_000_000);
    expect(sut.unitOfWork.transfers.size).toBe(0);
    expect(sut.unitOfWork.journalEntries.size).toBe(0);

    const assessment = Array.from(sut.unitOfWork.riskAssessments.values())[0];
    expect(assessment?.decision).toBe(RiskDecision.BLOCK);
    expect(assessment?.transferId).toBeNull();
  });

  it('retém transferência de risco médio para revisão e aprova depois', async () => {
    const sut = createSut(1_000_000);

    const result = await sut.processPixTransfer.execute({
      accountId: ACCOUNT_ID,
      targetKey: 'destinatario@example.com',
      amountCents: 500_000,
      idempotencyKey: 'revisao',
    });

    expect(result.transfer.status).toBe(PixTransferStatus.PENDING_REVIEW);
    expect(result.transfer.riskDecision).toBe(RiskDecision.REVIEW);
    expect(result.availableBalanceCents).toBe(1_000_000);
    expect(sut.unitOfWork.journalEntries.size).toBe(0);

    const approved = await sut.approveReviewedTransfer.execute({
      transferId: result.transfer.transferId,
    });

    expect(approved.transfer.status).toBe(PixTransferStatus.SETTLED);
    expect(approved.availableBalanceCents).toBe(500_000);
    expect(sut.unitOfWork.journalEntries.size).toBe(1);
  });

  it('rejeita transferência retida sem debitar o saldo', async () => {
    const sut = createSut(1_000_000);

    const result = await sut.processPixTransfer.execute({
      accountId: ACCOUNT_ID,
      targetKey: 'destinatario@example.com',
      amountCents: 500_000,
      idempotencyKey: 'rejeicao',
    });

    const rejected = await sut.rejectReviewedTransfer.execute({
      transferId: result.transfer.transferId,
    });

    expect(rejected.status).toBe(PixTransferStatus.REJECTED);
    expect(sut.unitOfWork.accounts.get(ACCOUNT_ID)?.availableBalanceCents).toBe(1_000_000);
    expect(sut.unitOfWork.journalEntries.size).toBe(0);
  });

  it('mantém transferência IN_DOUBT quando o parceiro BaaS falha', async () => {
    const sut = createSut(10_000);
    sut.paymentRail.failNext = true;

    const result = await sut.processPixTransfer.execute({
      accountId: ACCOUNT_ID,
      targetKey: 'destinatario@example.com',
      amountCents: 5_000,
      idempotencyKey: 'baas-offline',
    });

    expect(result.transfer.status).toBe(PixTransferStatus.IN_DOUBT);
    expect(result.availableBalanceCents).toBe(5_000);
    expect(sut.unitOfWork.accounts.get(ACCOUNT_ID)?.availableBalanceCents).toBe(5_000);
  });

  it('valida Idempotency-Key e valor da transferência', async () => {
    const sut = createSut();

    await expect(
      sut.processPixTransfer.execute({
        accountId: ACCOUNT_ID,
        targetKey: 'destinatario@example.com',
        amountCents: 5_000,
        idempotencyKey: ' ',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      sut.processPixTransfer.execute({
        accountId: ACCOUNT_ID,
        targetKey: 'destinatario@example.com',
        amountCents: 0,
        idempotencyKey: 'valor-zero',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
