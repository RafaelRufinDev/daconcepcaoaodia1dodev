import type {
  PaymentRail,
  PaymentRailInput,
  PaymentRailResult,
} from '../../src/application/ports/payment-rail';

export class RecordingPaymentRail implements PaymentRail {
  readonly calls: PaymentRailInput[] = [];
  failNext = false;

  async send(input: PaymentRailInput): Promise<PaymentRailResult> {
    this.calls.push(input);

    if (this.failNext) {
      this.failNext = false;
      throw new Error('BaaS indisponível');
    }

    return { baasTransferId: `BAAS-${this.calls.length}` };
  }
}
