import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { CustomerStatus } from '../../../../domain/enums/customer-status';

@Entity({ name: 'customers', schema: 'iam' })
export class CustomerEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName!: string;

  @Column({ name: 'tax_id_hash', type: 'char', length: 64, unique: true })
  taxIdHash!: string;

  @Column({ name: 'email_normalized', type: 'varchar', length: 254, unique: true })
  emailNormalized!: string;

  @Column({ name: 'phone_encrypted', type: 'bytea' })
  phoneEncrypted!: Buffer;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 100, nullable: true, unique: true })
  keycloakUserId!: string | null;

  @Column({ type: 'enum', enum: CustomerStatus, enumName: 'customer_status' })
  status!: CustomerStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
