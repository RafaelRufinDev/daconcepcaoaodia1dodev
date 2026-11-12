import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS iam`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ledger`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS payments`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS risk`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS platform`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE iam.customer_status AS ENUM ('PENDING_KYC', 'ACTIVE', 'BLOCKED', 'CLOSED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ledger.entry_status AS ENUM ('POSTED', 'REVERSED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payments.pix_status AS ENUM (
          'CREATED', 'PENDING', 'PENDING_REVIEW', 'IN_DOUBT', 'SETTLED', 'REJECTED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE risk.decision AS ENUM ('APPROVE', 'CHALLENGE', 'REVIEW', 'BLOCK');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS iam.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(150) NOT NULL,
        tax_id_hash CHAR(64) NOT NULL UNIQUE,
        email_normalized VARCHAR(254) NOT NULL UNIQUE,
        phone_encrypted BYTEA NOT NULL,
        keycloak_user_id VARCHAR(100) UNIQUE,
        status iam.customer_status NOT NULL DEFAULT 'PENDING_KYC',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ledger.accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES iam.customers(id) ON DELETE RESTRICT,
        account_number VARCHAR(24) NOT NULL UNIQUE,
        currency CHAR(3) NOT NULL DEFAULT 'BRL',
        available_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (available_balance_cents >= 0),
        version BIGINT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ledger.journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        idempotency_key VARCHAR(100) NOT NULL UNIQUE,
        reference_type VARCHAR(40) NOT NULL,
        reference_id UUID NOT NULL,
        status ledger.entry_status NOT NULL DEFAULT 'POSTED',
        reversal_of UUID REFERENCES ledger.journal_entries(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ledger.postings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entry_id UUID NOT NULL REFERENCES ledger.journal_entries(id) ON DELETE RESTRICT,
        account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
        signed_amount_cents BIGINT NOT NULL CHECK (signed_amount_cents <> 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments.pix_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
        target_key VARCHAR(255) NOT NULL,
        amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
        idempotency_key VARCHAR(100) NOT NULL UNIQUE,
        status payments.pix_status NOT NULL DEFAULT 'CREATED',
        risk_decision risk.decision NOT NULL,
        risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
        risk_reason VARCHAR(255) NOT NULL,
        baas_transfer_id VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk.assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transfer_id UUID REFERENCES payments.pix_transfers(id) ON DELETE SET NULL,
        account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
        idempotency_key VARCHAR(100) NOT NULL,
        target_key VARCHAR(255) NOT NULL,
        amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
        score INT NOT NULL CHECK (score >= 0 AND score <= 100),
        decision risk.decision NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_postings_account_date
      ON ledger.postings(account_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_journal_entries_idempotency
      ON ledger.journal_entries(idempotency_key)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_pix_transfers_account_date
      ON payments.pix_transfers(account_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_pix_transfers_status
      ON payments.pix_transfers(status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_risk_assessments_account_date
      ON risk.assessments(account_id, created_at DESC)
    `);

    await queryRunner.query(`
      INSERT INTO iam.customers (
        id, full_name, tax_id_hash, email_normalized, phone_encrypted, keycloak_user_id, status
      )
      VALUES (
        '00000000-0000-4000-8000-000000000001',
        'Aurora Pay Clearing',
        repeat('0', 64),
        'clearing@aurorapay.local',
        decode('00', 'hex'),
        NULL,
        'ACTIVE'
      )
      ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO ledger.accounts (
        id, customer_id, account_number, currency, available_balance_cents, version
      )
      VALUES (
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        'CLEARING-0001',
        'BRL',
        1000000000,
        1
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS audit CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS platform CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS risk CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS payments CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS ledger CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS iam CASCADE`);
  }
}
