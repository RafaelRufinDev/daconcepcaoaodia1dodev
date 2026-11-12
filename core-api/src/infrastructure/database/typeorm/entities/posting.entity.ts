import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer';

@Entity({ name: 'postings', schema: 'ledger' })
export class PostingEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'entry_id', type: 'uuid' })
  entryId!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({
    name: 'signed_amount_cents',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  signedAmountCents!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
