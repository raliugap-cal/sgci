// ═══════════════════════════════════════════════════════════
// ENCRYPTION SERVICE — AES-256-GCM para campos PHI (LFPDPPP)
// Cifra: CURP, RFC, email, teléfono, WhatsApp, secretos MFA
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly TAG_LENGTH = 16;
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    const rawKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    // Derivar clave de 32 bytes con SHA-256
    this.key = crypto.createHash('sha256').update(rawKey).digest();
    this.logger.log('✅ EncryptionService inicializado');
  }

  /**
   * Cifra un string y retorna Buffer (IV + ciphertext + authTag)
   * Formato: [16 bytes IV] + [N bytes ciphertext] + [16 bytes authTag]
   */
  encrypt(plaintext: string): Buffer {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, encrypted, tag]);
  }

  /**
   * Descifra un Buffer previamente cifrado con encrypt()
   */
  decrypt(cipherBuffer: Buffer): string {
    const iv = cipherBuffer.subarray(0, this.IV_LENGTH);
    const tag = cipherBuffer.subarray(cipherBuffer.length - this.TAG_LENGTH);
    const ciphertext = cipherBuffer.subarray(this.IV_LENGTH, cipherBuffer.length - this.TAG_LENGTH);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  /**
   * Versión string-to-string (base64) para campos de texto en config
   */
  encryptString(plaintext: string): string {
    return this.encrypt(plaintext).toString('base64');
  }

  decryptString(cipherBase64: string): string {
    return this.decrypt(Buffer.from(cipherBase64, 'base64'));
  }

  /**
   * Hash unidireccional para tokens de verificación
   */
  hash(value: string): string {
    return crypto.createHmac('sha256', this.key).update(value).digest('hex');
  }

  /**
   * Hash de contenido para firma digital simple (NOM-004)
   * firma_hash = SHA-256(contenido + medicoId + timestamp)
   */
  signContent(content: string, medicoId: string): string {
    const payload = `${content}|${medicoId}|${Date.now()}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
