import { randomUUID } from 'node:crypto';
import type {
  PaymentRail,
  PaymentRailInput,
  PaymentRailResult,
} from '../../application/ports/payment-rail';

export class MockBaasPaymentRail implements PaymentRail {
  async send(_input: PaymentRailInput): Promise<PaymentRailResult> {
    return {
      baasTransferId: `BAAS-${randomUUID()}`,
    };
  }
}
