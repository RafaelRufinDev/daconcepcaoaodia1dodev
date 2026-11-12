import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnv } from '../../../config/env';
import { AccountEntity } from './entities/account.entity';
import { CustomerEntity } from './entities/customer.entity';
import { JournalEntryEntity } from './entities/journal-entry.entity';
import { PixTransferEntity } from './entities/pix-transfer.entity';
import { PostingEntity } from './entities/posting.entity';
import { RiskAssessmentEntity } from './entities/risk-assessment.entity';
import { InitialSchema1700000000000 } from './migrations/1700000000000-initial-schema';

const env = loadEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  entities: [
    CustomerEntity,
    AccountEntity,
    JournalEntryEntity,
    PostingEntity,
    PixTransferEntity,
    RiskAssessmentEntity,
  ],
  migrations: [InitialSchema1700000000000],
  synchronize: false,
  migrationsRun: false,
  logging: false,
  extra: {
    max: 10,
  },
});
