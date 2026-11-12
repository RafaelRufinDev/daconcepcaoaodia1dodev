import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('*'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1).default('aurora_dev'),
  DB_PASS: z.string().min(1).default('aurora_dev_password'),
  DB_NAME: z.string().min(1).default('aurora_core_db'),
  DB_SSL: booleanFromString.default('false'),

  JWT_SECRET: z.string().optional(),
  ANTI_FRAUD_SERVICE_URL: z.string().url().optional(),
  RISK_ENGINE: z.enum(['local', 'http']).default('local'),
  RISK_REVIEW_THRESHOLD_CENTS: z.coerce.number().int().positive().default(500_000),
  RISK_BLOCK_THRESHOLD_CENTS: z.coerce.number().int().positive().default(1_000_000),
  BACEN_PIX_API_KEY: z.string().default('mock_key_para_desenvolvimento_local'),
  ADMIN_API_KEY: z.string().min(1).default('dev_admin_key'),

  PII_HMAC_KEY: z.string().min(16),
  PII_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, 'PII_ENCRYPTION_KEY deve ter 64 caracteres hexadecimais'),

  CLEARING_ACCOUNT_NUMBER: z.string().min(1).default('CLEARING-0001'),
  ENABLE_SANDBOX_ENDPOINTS: booleanFromString.default('true'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }

  return parsed.data;
}
