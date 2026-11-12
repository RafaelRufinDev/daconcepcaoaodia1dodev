import { z } from 'zod';
import type {
  RiskEngine,
  RiskEngineInput,
  RiskEngineResult,
} from '../../application/ports/risk-engine';
import { RiskDecision } from '../../domain/enums/risk-decision';

const riskResponseSchema = z.object({
  decision: z.nativeEnum(RiskDecision),
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1),
});

export class HttpRiskEngine implements RiskEngine {
  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = 150,
  ) {}

  async assess(input: RiskEngineInput): Promise<RiskEngineResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Motor antifraude retornou HTTP ${response.status}`);
    }

    return riskResponseSchema.parse(await response.json());
  }
}

export class FallbackRiskEngine implements RiskEngine {
  constructor(
    private readonly primary: RiskEngine,
    private readonly fallback: RiskEngine,
  ) {}

  async assess(input: RiskEngineInput): Promise<RiskEngineResult> {
    try {
      return await this.primary.assess(input);
    } catch {
      return this.fallback.assess(input);
    }
  }
}
