export interface PiiProtection {
  hashTaxId(taxId: string): string;
  encryptPhone(phone: string): Buffer;
  decryptPhone(payload: Buffer): string;
  normalizeEmail(email: string): string;
}
