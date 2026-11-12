import type { ValueTransformer } from 'typeorm';

export const bigintTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};
