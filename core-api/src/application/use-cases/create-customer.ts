import { randomInt, randomUUID } from 'node:crypto';
import { Account } from '../../domain/entities/account';
import { Customer } from '../../domain/entities/customer';
import { CustomerStatus } from '../../domain/enums/customer-status';
import { AppError, ValidationError } from '../../domain/errors/app-error';
import { assertValidCpf } from '../../domain/value-objects/cpf';
import type { PiiProtection } from '../ports/pii-protection';
import type { UnitOfWork } from '../ports/unit-of-work';

export interface CreateCustomerInput {
  fullName: string;
  taxId: string;
  email: string;
  phone: string;
}

export interface CreateCustomerOutput {
  customerId: string;
  accountId: string;
  accountNumber: string;
  status: CustomerStatus;
}

export class CreateCustomerUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly piiProtection: PiiProtection,
  ) {}

  async execute(input: CreateCustomerInput): Promise<CreateCustomerOutput> {
    const fullName = input.fullName.trim();
    const emailNormalized = this.piiProtection.normalizeEmail(input.email);
    const phone = input.phone.trim();

    if (fullName.length < 3) {
      throw new ValidationError('O nome completo deve ter no mínimo 3 caracteres');
    }
    if (!isValidEmail(emailNormalized)) {
      throw new ValidationError('E-mail inválido');
    }
    if (phone.length < 10 || phone.length > 20) {
      throw new ValidationError('Telefone inválido');
    }

    const taxId = assertValidCpf(input.taxId);
    const taxIdHash = this.piiProtection.hashTaxId(taxId);

    return this.unitOfWork.execute(async (context) => {
      const existingTaxId = await context.customerRepository.findByTaxIdHash(taxIdHash);
      if (existingTaxId) {
        throw new AppError(409, 'Cliente já cadastrado com este CPF', 'CUSTOMER_ALREADY_EXISTS');
      }

      const existingEmail = await context.customerRepository.findByEmail(emailNormalized);
      if (existingEmail) {
        throw new AppError(409, 'Cliente já cadastrado com este e-mail', 'CUSTOMER_ALREADY_EXISTS');
      }

      const customer = Customer.restore({
        id: randomUUID(),
        fullName,
        taxIdHash,
        emailNormalized,
        phoneEncrypted: this.piiProtection.encryptPhone(phone),
        keycloakUserId: null,
        status: CustomerStatus.ACTIVE,
        createdAt: new Date(),
      });

      const account = Account.restore({
        id: randomUUID(),
        customerId: customer.id,
        accountNumber: generateAccountNumber(),
        currency: 'BRL',
        availableBalanceCents: 0,
        version: 1,
        createdAt: new Date(),
      });

      await context.customerRepository.save(customer);
      await context.accountRepository.save(account);

      return {
        customerId: customer.id,
        accountId: account.id,
        accountNumber: account.accountNumber,
        status: customer.status,
      };
    });
  }
}

function generateAccountNumber(): string {
  return randomInt(0, 1_000_000_000_000).toString().padStart(12, '0');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
