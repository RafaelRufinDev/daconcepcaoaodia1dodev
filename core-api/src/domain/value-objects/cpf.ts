import { ValidationError } from '../errors/app-error';

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split('').map(Number);

  const firstCheckDigit = calculateCheckDigit(digits, 9);
  if (digits[9] !== firstCheckDigit) {
    return false;
  }

  const secondCheckDigit = calculateCheckDigit(digits, 10);
  return digits[10] === secondCheckDigit;
}

export function assertValidCpf(value: string): string {
  const cpf = normalizeCpf(value);

  if (!isValidCpf(cpf)) {
    throw new ValidationError('CPF inválido');
  }

  return cpf;
}

function calculateCheckDigit(digits: number[], length: number): number {
  let sum = 0;

  for (let index = 0; index < length; index += 1) {
    sum += (digits[index] ?? 0) * (length + 1 - index);
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
