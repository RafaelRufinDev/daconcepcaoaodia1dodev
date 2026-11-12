import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer';

@Entity({ name: 'accounts', schema: 'ledger' })
export class AccountEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'account_number', type: 'varchar', length: 24, unique: true })
  accountNumber!: string;

  @Column({ type: 'char', length: 3, default: 'BRL' })
  currency!: string;

  @Column({
    name: 'available_balance_cents',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  availableBalanceCents!: number;

  @Column({ type: 'bigint', transformer: bigintTransformer, default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
