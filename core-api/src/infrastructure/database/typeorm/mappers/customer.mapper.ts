import { Customer } from '../../../../domain/entities/customer';
import type { CustomerEntity } from '../entities/customer.entity';

export function toCustomerDomain(entity: CustomerEntity): Customer {
  return Customer.restore({
    id: entity.id,
    fullName: entity.fullName,
    taxIdHash: entity.taxIdHash,
    emailNormalized: entity.emailNormalized,
    phoneEncrypted: entity.phoneEncrypted,
    keycloakUserId: entity.keycloakUserId,
    status: entity.status,
    createdAt: entity.createdAt,
  });
}

export function toCustomerPersistence(customer: Customer): CustomerEntity {
  const entity = {
    id: customer.id,
    fullName: customer.fullName,
    taxIdHash: customer.taxIdHash,
    emailNormalized: customer.emailNormalized,
    phoneEncrypted: customer.phoneEncrypted,
    keycloakUserId: customer.keycloakUserId,
    status: customer.status,
    createdAt: customer.createdAt,
  } as CustomerEntity;

  return entity;
}
