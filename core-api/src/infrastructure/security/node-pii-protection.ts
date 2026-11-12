import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { PiiProtection } from '../../application/ports/pii-protection';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class NodePiiProtection implements PiiProtection {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly hmacKey: string,
    encryptionKeyHex: string,
  ) {
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');

    if (this.encryptionKey.length !== 32) {
      throw new Error('PII_ENCRYPTION_KEY deve representar exatamente 32 bytes');
    }
  }

  hashTaxId(taxId: string): string {
    return createHmac('sha256', this.hmacKey).update(taxId.replace(/\D/g, '')).digest('hex');
  }

  encryptPhone(phone: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]);
  }

  decryptPhone(payload: Buffer): string {
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
