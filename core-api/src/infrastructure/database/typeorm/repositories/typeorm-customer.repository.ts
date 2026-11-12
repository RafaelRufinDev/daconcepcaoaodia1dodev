import type { EntityManager } from 'typeorm';
import type { CustomerRepository } from '../../../../application/ports/customer-repository';
import type { Customer } from '../../../../domain/entities/customer';
import { AppError } from '../../../../domain/errors/app-error';
import { CustomerEntity } from '../entities/customer.entity';
import { isUniqueViolation } from '../is-unique-violation';
import { toCustomerDomain, toCustomerPersistence } from '../mappers/customer.mapper';

export class TypeOrmCustomerRepository implements CustomerRepository {
  constructor(private readonly manager: EntityManager) {}

  async findById(id: string): Promise<Customer | null> {
    const entity = await this.manager.getRepository(CustomerEntity).findOne({ where: { id } });
    return entity ? toCustomerDomain(entity) : null;
  }

  async findByEmail(emailNormalized: string): Promise<Customer | null> {
    const entity = await this.manager
      .getRepository(CustomerEntity)
      .findOne({ where: { emailNormalized } });
    return entity ? toCustomerDomain(entity) : null;
  }

  async findByTaxIdHash(taxIdHash: string): Promise<Customer | null> {
    const entity = await this.manager
      .getRepository(CustomerEntity)
      .findOne({ where: { taxIdHash } });
    return entity ? toCustomerDomain(entity) : null;
  }

  async save(customer: Customer): Promise<void> {
    try {
      await this.manager.getRepository(CustomerEntity).save(toCustomerPersistence(customer));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, 'Cliente já cadastrado', 'CUSTOMER_ALREADY_EXISTS');
      }
      throw error;
    }
  }
}
