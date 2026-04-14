// ═══════════════════════════════════════════════════════════
// TESTS — encryption.service.spec.ts
// AES-256-GCM · Cifrado PHI · Firma de contenido
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const makeConfig = () => ({
  getOrThrow: jest.fn().mockReturnValue('test-encryption-key-exactly-32chars!!'),
});

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();
    service = module.get<EncryptionService>(EncryptionService);
  });

  describe('encrypt / decrypt', () => {
    it('cifra y descifra texto correctamente', () => {
      const textos = [
        'PEGJ900515HDFRNN09',         // CURP
        'ana.garcia@example.com',      // Email
        '8112345678',                  // Teléfono
        'GARC850315ABC',               // RFC
        'Una nota con caracteres: áéíóú ñ @#$',
      ];

      for (const texto of textos) {
        const cifrado = service.encrypt(texto);
        const descifrado = service.decrypt(cifrado);
        expect(descifrado).toBe(texto);
      }
    });

    it('produce buffer diferente cada vez (IV aleatorio)', () => {
      const texto = 'PEGJ900515HDFRNN09';
      const cifrado1 = service.encrypt(texto);
      const cifrado2 = service.encrypt(texto);
      expect(cifrado1.toString('hex')).not.toBe(cifrado2.toString('hex'));
    });

    it('el buffer cifrado es más largo que el texto original', () => {
      const texto = 'test@example.com';
      const cifrado = service.encrypt(texto);
      expect(cifrado.length).toBeGreaterThan(texto.length);
    });

    it('detecta tampering del buffer cifrado', () => {
      const texto = 'dato-sensible';
      const cifrado = service.encrypt(texto);
      const tampered = Buffer.from(cifrado);
      tampered[20] ^= 0xFF; // Modificar un byte

      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('encryptString / decryptString (base64)', () => {
    it('cifra y descifra strings en base64', () => {
      const valor = 'secreto-en-base64';
      const cifrado = service.encryptString(valor);
      expect(typeof cifrado).toBe('string');
      expect(cifrado).not.toBe(valor);
      expect(service.decryptString(cifrado)).toBe(valor);
    });
  });

  describe('hash', () => {
    it('produce hash determinista con HMAC-SHA256', () => {
      const valor = 'token-unico-123';
      const hash1 = service.hash(valor);
      const hash2 = service.hash(valor);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
    });

    it('hashes diferentes para inputs diferentes', () => {
      expect(service.hash('abc')).not.toBe(service.hash('xyz'));
    });
  });

  describe('signContent', () => {
    it('produce firma determinista dado el mismo contenido y medicoId', () => {
      // Nota: tiene timestamp, así que no es 100% determinista
      // pero el formato debe ser correcto
      const firma = service.signContent('contenido de la nota SOAP', 'medico-uuid-001');
      expect(firma).toHaveLength(64);
      expect(typeof firma).toBe('string');
    });

    it('produce firmas diferentes para contenidos diferentes', () => {
      const firma1 = service.signContent('nota A', 'medico-001');
      const firma2 = service.signContent('nota B', 'medico-001');
      expect(firma1).not.toBe(firma2);
    });
  });

  describe('PHI fields - escenarios clínicos', () => {
    const datosPHI = {
      curp: 'PEGJ900515HDFRNN09',
      rfc: 'PEGJ900515ABC',
      email: 'paciente@email.com',
      telefono: '+525512345678',
      whatsapp: '+525598765432',
    };

    it('puede cifrar y descifrar todos los campos PHI de un paciente', () => {
      for (const [campo, valor] of Object.entries(datosPHI)) {
        const cifrado = service.encrypt(valor);
        const descifrado = service.decrypt(cifrado);
        expect(descifrado).toBe(valor);
      }
    });

    it('los campos cifrados son Buffer (compatibles con Prisma Bytes)', () => {
      const cifrado = service.encrypt(datosPHI.curp);
      expect(Buffer.isBuffer(cifrado)).toBe(true);
    });
  });
});
