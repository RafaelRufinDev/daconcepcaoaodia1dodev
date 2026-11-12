import { ApproveReviewedTransferUseCase } from '../../src/application/use-cases/approve-reviewed-transfer';
import { ProcessPixTransferUseCase } from '../../src/application/use-cases/process-pix-transfer';
import { RejectReviewedTransferUseCase } from '../../src/application/use-cases/reject-reviewed-transfer';
import { RiskDecision } from '../../src/domain/enums/risk-decision';
import { InsufficientFundsError } from '../../src/domain/errors/app-error';
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

function createSut(balanceCents = 1_000_000): Sut {
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

  return {
    unitOfWork,
    paymentRail,
    processPixTransfer: new ProcessPixTransferUseCase(
      unitOfWork,
      new LocalRiskEngine(500_000, 1_000_000),
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

async function createReviewedTransfer(sut: Sut): Promise<string> {
  const result = await sut.processPixTransfer.execute({
    accountId: ACCOUNT_ID,
    targetKey: 'revisao@example.com',
    amountCents: 500_000,
    idempotencyKey: `review-${Math.random()}`,
  });

  expect(result.transfer.riskDecision).toBe(RiskDecision.REVIEW);
  return result.transfer.transferId;
}

describe('Erros de compliance', () => {
  it('retorna 404 ao aprovar ou rejeitar transferência inexistente', async () => {
    const sut = createSut();

    await expect(
      sut.approveReviewedTransfer.execute({
        transferId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'TRANSFER_NOT_FOUND' });

    await expect(
      sut.rejectReviewedTransfer.execute({
        transferId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'TRANSFER_NOT_FOUND' });
  });

  it('retorna 409 ao tentar revisar transferência já liquidada', async () => {
    const sut = createSut(10_000);
    const transfer = await sut.processPixTransfer.execute({
      accountId: ACCOUNT_ID,
      targetKey: 'aprovada@example.com',
      amountCents: 5_000,
      idempotencyKey: 'ja-liquidada',
    });

    await expect(
      sut.approveReviewedTransfer.execute({ transferId: transfer.transfer.transferId }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TRANSFER_NOT_IN_REVIEW' });

    await expect(
      sut.rejectReviewedTransfer.execute({ transferId: transfer.transfer.transferId }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TRANSFER_NOT_IN_REVIEW' });
  });

  it('retorna 422 ao aprovar revisão sem saldo suficiente', async () => {
    const sut = createSut(1_000_000);
    const transferId = await createReviewedTransfer(sut);
    const account = sut.unitOfWork.accounts.get(ACCOUNT_ID);
    if (!account) {
      throw new Error('Conta de origem não encontrada');
    }
    account.debit(account.availableBalanceCents);

    await expect(sut.approveReviewedTransfer.execute({ transferId })).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
  });

  it('retorna 404 ao aprovar revisão quando a conta de origem sumiu', async () => {
    const sut = createSut();
    const transferId = await createReviewedTransfer(sut);
    sut.unitOfWork.accounts.delete(ACCOUNT_ID);

    await expect(sut.approveReviewedTransfer.execute({ transferId })).rejects.toMatchObject({
      statusCode: 404,
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('retorna 500 ao aprovar revisão sem conta contábil interna', async () => {
    const sut = createSut();
    const transferId = await createReviewedTransfer(sut);
    sut.unitOfWork.accounts.delete('00000000-0000-4000-8000-000000000002');

    await expect(sut.approveReviewedTransfer.execute({ transferId })).rejects.toMatchObject({
      statusCode: 500,
      code: 'CLEARING_ACCOUNT_NOT_CONFIGURED',
    });
  });
});
