import type { CustomerStatus } from '../enums/customer-status';

export interface CustomerProps {
  id: string;
  fullName: string;
  taxIdHash: string;
  emailNormalized: string;
  phoneEncrypted: Buffer;
  keycloakUserId: string | null;
  status: CustomerStatus;
  createdAt: Date;
}

export class Customer {
  private constructor(private readonly props: CustomerProps) {}

  static restore(props: CustomerProps): Customer {
    return new Customer({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get taxIdHash(): string {
    return this.props.taxIdHash;
  }

  get emailNormalized(): string {
    return this.props.emailNormalized;
  }

  get phoneEncrypted(): Buffer {
    return this.props.phoneEncrypted;
  }

  get keycloakUserId(): string | null {
    return this.props.keycloakUserId;
  }

  get status(): CustomerStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
