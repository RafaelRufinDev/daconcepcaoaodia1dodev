import { z } from 'zod';

export const createCustomerBodySchema = z.object({
  fullName: z.string().trim().min(3).max(150),
  taxId: z.string().trim().min(11).max(20),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(10).max(20),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const pixTransferBodySchema = z.object({
  accountId: z.string().uuid(),
  targetKey: z.string().trim().min(1).max(255),
  amountCents: z.number().int().positive().max(100_000_000),
});

export const depositBodySchema = z.object({
  accountId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_000),
});

export const customerIdParamSchema = z.object({
  customerId: z.string().uuid(),
});

export const transferIdParamSchema = z.object({
  transferId: z.string().uuid(),
});
