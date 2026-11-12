import { ValidationError, InsufficientFundsError } from '../errors/app-error';

export interface AccountProps {
  id: string;
  customerId: string;
  accountNumber: string;
  currency: string;
  availableBalanceCents: number;
  version: number;
  createdAt: Date;
}

export class Account {
  private constructor(private readonly props: AccountProps) {}

  static restore(props: AccountProps): Account {
    return new Account({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get accountNumber(): string {
    return this.props.accountNumber;
  }

  get currency(): string {
    return this.props.currency;
  }

  get availableBalanceCents(): number {
    return this.props.availableBalanceCents;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  debit(amountCents: number): void {
    this.assertValidAmount(amountCents);

    if (this.props.availableBalanceCents < amountCents) {
      throw new InsufficientFundsError();
    }

    this.props.availableBalanceCents -= amountCents;
    this.props.version += 1;
  }

  credit(amountCents: number): void {
    this.assertValidAmount(amountCents);

    const nextBalance = this.props.availableBalanceCents + amountCents;
    if (!Number.isSafeInteger(nextBalance)) {
      throw new ValidationError('Valor excede o limite suportado pela conta');
    }

    this.props.availableBalanceCents = nextBalance;
    this.props.version += 1;
  }

  private assertValidAmount(amountCents: number): void {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new ValidationError('O valor deve ser um inteiro positivo em centavos');
    }
  }
}
