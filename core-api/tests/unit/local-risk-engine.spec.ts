import { RiskDecision } from '../../src/domain/enums/risk-decision';
import { LocalRiskEngine } from '../../src/infrastructure/risk/local-risk-engine';

const baseInput = {
  accountId: '11111111-1111-4111-8111-111111111111',
  customerId: '22222222-2222-4222-8222-222222222222',
  targetKey: 'destinatario@example.com',
  idempotencyKey: 'risk-1',
};

describe('LocalRiskEngine', () => {
  const engine = new LocalRiskEngine(500_000, 1_000_000);

  it('aprova valores abaixo do limite de revisão', async () => {
    const result = await engine.assess({ ...baseInput, amountCents: 499_999 });

    expect(result.decision).toBe(RiskDecision.APPROVE);
    expect(result.score).toBeLessThan(50);
  });

  it('envia valores acima do limite de revisão para análise manual', async () => {
    const result = await engine.assess({ ...baseInput, amountCents: 500_000 });

    expect(result.decision).toBe(RiskDecision.REVIEW);
  });

  it('bloqueia valores acima do limite máximo de segurança', async () => {
    const result = await engine.assess({ ...baseInput, amountCents: 1_000_000 });

    expect(result.decision).toBe(RiskDecision.BLOCK);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});
