import type { RiskDecision } from '../enums/risk-decision';

export interface RiskAssessmentProps {
  id: string;
  transferId: string | null;
  accountId: string;
  idempotencyKey: string;
  targetKey: string;
  amountCents: number;
  score: number;
  decision: RiskDecision;
  reason: string;
  createdAt: Date;
}

export class RiskAssessment {
  private constructor(private readonly props: RiskAssessmentProps) {}

  static create(props: Omit<RiskAssessmentProps, 'createdAt'>): RiskAssessment {
    return new RiskAssessment({
      ...props,
      createdAt: new Date(),
    });
  }

  static restore(props: RiskAssessmentProps): RiskAssessment {
    return new RiskAssessment({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get transferId(): string | null {
    return this.props.transferId;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get targetKey(): string {
    return this.props.targetKey;
  }

  get amountCents(): number {
    return this.props.amountCents;
  }

  get score(): number {
    return this.props.score;
  }

  get decision(): RiskDecision {
    return this.props.decision;
  }

  get reason(): string {
    return this.props.reason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
