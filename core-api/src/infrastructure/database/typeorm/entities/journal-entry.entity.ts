import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { LedgerEntryStatus } from '../../../../domain/enums/ledger-entry-status';

@Entity({ name: 'journal_entries', schema: 'ledger' })
export class JournalEntryEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, unique: true })
  idempotencyKey!: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 40 })
  referenceType!: string;

  @Column({ name: 'reference_id', type: 'uuid' })
  referenceId!: string;

  @Column({ type: 'enum', enum: LedgerEntryStatus, enumName: 'entry_status' })
  status!: LedgerEntryStatus;

  @Column({ name: 'reversal_of', type: 'uuid', nullable: true })
  reversalOf!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
