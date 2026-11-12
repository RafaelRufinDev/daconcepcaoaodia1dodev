export interface PaymentRailInput {
  transferId: string;
  accountId: string;
  targetKey: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface PaymentRailResult {
  baasTransferId: string;
}

export interface PaymentRail {
  send(input: PaymentRailInput): Promise<PaymentRailResult>;
}
