import { PixTransferStatus } from '../enums/pix-transfer-status';
import type { RiskDecision } from '../enums/risk-decision';
import { ValidationError } from '../errors/app-error';

export interface PixTransferProps {
  id: string;
  accountId: string;
  targetKey: string;
  amountCents: number;
  idempotencyKey: string;
  status: PixTransferStatus;
  riskDecision: RiskDecision;
  riskScore: number;
  riskReason: string;
  baasTransferId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePixTransferInput {
  id: string;
  accountId: string;
  targetKey: string;
  amountCents: number;
  idempotencyKey: string;
  riskDecision: RiskDecision;
  riskScore: number;
  riskReason: string;
}

export class PixTransfer {
  private constructor(private props: PixTransferProps) {}

  static createForProcessing(input: CreatePixTransferInput): PixTransfer {
    PixTransfer.validate(input);

    const now = new Date();
    return new PixTransfer({
      ...input,
      status: PixTransferStatus.PENDING,
      baasTransferId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static createForReview(input: CreatePixTransferInput): PixTransfer {
    PixTransfer.validate(input);

    const now = new Date();
    return new PixTransfer({
      ...input,
      status: PixTransferStatus.PENDING_REVIEW,
      baasTransferId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: PixTransferProps): PixTransfer {
    return new PixTransfer({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get targetKey(): string {
    return this.props.targetKey;
  }

  get amountCents(): number {
    return this.props.amountCents;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get status(): PixTransferStatus {
    return this.props.status;
  }

  get riskDecision(): RiskDecision {
    return this.props.riskDecision;
  }

  get riskScore(): number {
    return this.props.riskScore;
  }

  get riskReason(): string {
    return this.props.riskReason;
  }

  get baasTransferId(): string | null {
    return this.props.baasTransferId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  markSettled(baasTransferId: string): void {
    if (this.props.status === PixTransferStatus.SETTLED) {
      return;
    }
    if (this.props.status === PixTransferStatus.REJECTED) {
      throw new ValidationError('Transferência rejeitada não pode ser liquidada');
    }

    this.props.status = PixTransferStatus.SETTLED;
    this.props.baasTransferId = baasTransferId;
    this.props.updatedAt = new Date();
  }

  markInDoubt(): void {
    if (this.props.status === PixTransferStatus.SETTLED) {
      return;
    }

    this.props.status = PixTransferStatus.IN_DOUBT;
    this.props.updatedAt = new Date();
  }

  markRejected(): void {
    if (this.props.status === PixTransferStatus.SETTLED) {
      throw new ValidationError('Transferência liquidada não pode ser rejeitada');
    }

    this.props.status = PixTransferStatus.REJECTED;
    this.props.updatedAt = new Date();
  }

  private static validate(input: CreatePixTransferInput): void {
    if (!input.idempotencyKey.trim()) {
      throw new ValidationError('Idempotency-Key é obrigatória');
    }
    if (!input.targetKey.trim()) {
      throw new ValidationError('A chave PIX de destino é obrigatória');
    }
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new ValidationError('O valor da transferência deve ser positivo em centavos');
    }
  }
}
