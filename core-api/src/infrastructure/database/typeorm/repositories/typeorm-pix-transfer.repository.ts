import type { EntityManager } from 'typeorm';
import type {
  PaginatedResult,
  PaginationInput,
  PixTransferRepository,
} from '../../../../application/ports/pix-transfer-repository';
import type { PixTransfer } from '../../../../domain/entities/pix-transfer';
import type { PixTransferStatus } from '../../../../domain/enums/pix-transfer-status';
import { DuplicateIdempotencyKeyError } from '../../../../domain/errors/app-error';
import { PixTransferEntity } from '../entities/pix-transfer.entity';
import { isUniqueViolation } from '../is-unique-violation';
import { toPixTransferDomain, toPixTransferPersistence } from '../mappers/pix-transfer.mapper';

export class TypeOrmPixTransferRepository implements PixTransferRepository {
  constructor(private readonly manager: EntityManager) {}

  async findById(id: string): Promise<PixTransfer | null> {
    const entity = await this.manager.getRepository(PixTransferEntity).findOne({ where: { id } });
    return entity ? toPixTransferDomain(entity) : null;
  }

  async findByIdForUpdate(id: string): Promise<PixTransfer | null> {
    const entity = await this.manager.getRepository(PixTransferEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return entity ? toPixTransferDomain(entity) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PixTransfer | null> {
    const entity = await this.manager
      .getRepository(PixTransferEntity)
      .findOne({ where: { idempotencyKey } });
    return entity ? toPixTransferDomain(entity) : null;
  }

  async save(transfer: PixTransfer): Promise<void> {
    try {
      await this.manager.getRepository(PixTransferEntity).save(toPixTransferPersistence(transfer));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateIdempotencyKeyError();
      }
      throw error;
    }
  }

  async listByAccount(
    accountId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<PixTransfer>> {
    const [entities, total] = await this.manager.getRepository(PixTransferEntity).findAndCount({
      where: { accountId },
      order: { createdAt: 'DESC' },
      take: pagination.limit,
      skip: pagination.offset,
    });

    return {
      items: entities.map(toPixTransferDomain),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  async listByStatus(
    status: PixTransferStatus,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<PixTransfer>> {
    const [entities, total] = await this.manager.getRepository(PixTransferEntity).findAndCount({
      where: { status },
      order: { createdAt: 'ASC' },
      take: pagination.limit,
      skip: pagination.offset,
    });

    return {
      items: entities.map(toPixTransferDomain),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }
}
