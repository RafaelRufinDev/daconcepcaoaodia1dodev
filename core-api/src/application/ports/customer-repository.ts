import type { Customer } from '../../domain/entities/customer';

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByEmail(emailNormalized: string): Promise<Customer | null>;
  findByTaxIdHash(taxIdHash: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
