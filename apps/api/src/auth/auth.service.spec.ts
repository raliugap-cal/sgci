// ═══════════════════════════════════════════════════════════
// TESTS — auth.service.spec.ts
// Login · MFA TOTP · Refresh token · Bloqueo por intentos
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

// ─── Mock factory helpers ─────────────────────────────────
const makePrisma = () => ({
  usuario: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  auditoria: { create: jest.fn() },
});

const makeJwt = () => ({
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  verify: jest.fn(),
});

const makeConfig = () => ({
  get: jest.fn((key: string, def?: any) => {
    const cfg: Record<string, any> = {
      JWT_SECRET: 'test-jwt-secret-at-least-32-chars!',
      ENCRYPTION_KEY: 'test-encryption-key-32-chars-abc!',
      NODE_ENV: 'test',
    };
    return cfg[key] ?? def;
  }),
  getOrThrow: jest.fn((key: string) => {
    const cfg: Record<string, string> = {
      JWT_SECRET: 'test-jwt-secret-at-least-32-chars!',
      ENCRYPTION_KEY: 'test-encryption-key-32-chars-abc!',
    };
    return cfg[key];
  }),
});

// ─── Datos de prueba ─────────────────────────────────────
const PASSWORD = 'SecurePassword@123';
const HASHED_PW = bcrypt.hashSync(PASSWORD, 10);

const MOCK_USER = {
  id: 'user-uuid-001',
  nombre: 'Carlos',
  apellidoPaterno: 'García',
  email: 'carlos@clinica.mx',
  passwordHash: HASHED_PW,
  roles: ['MEDICO'],
  sedeId: 'sede-uuid-001',
  activo: true,
  mfaActivo: false,
  mfaSecret: null,
  mfaBackupCodes: [],
  intentosFallidos: 0,
  bloqueadoHasta: null,
  medico: { id: 'medico-uuid-001' },
};

// ─── Tests ────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;
  let jwt: ReturnType<typeof makeJwt>;

  beforeEach(async () => {
    prisma = makePrisma();
    jwt = makeJwt();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── validateUser ───────────────────────────────────────
  describe('validateUser', () => {
    it('retorna el usuario cuando las credenciales son correctas', async () => {
      prisma.usuario.findUnique.mockResolvedValue(MOCK_USER);
      prisma.usuario.update.mockResolvedValue(MOCK_USER);

      const result = await service.validateUser('carlos@clinica.mx', PASSWORD);
      expect(result.email).toBe('carlos@clinica.mx');
      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { intentosFallidos: 0, bloqueadoHasta: null } }),
      );
    });

    it('lanza UnauthorizedException con contraseña incorrecta', async () => {
      prisma.usuario.findUnique.mockResolvedValue(MOCK_USER);
      prisma.usuario.update.mockResolvedValue({ ...MOCK_USER, intentosFallidos: 1 });

      await expect(service.validateUser('carlos@clinica.mx', 'WrongPass!'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.validateUser('noexiste@clinica.mx', PASSWORD))
        .rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario está inactivo', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ...MOCK_USER, activo: false });
      await expect(service.validateUser('carlos@clinica.mx', PASSWORD))
        .rejects.toThrow(UnauthorizedException);
    });

    it('bloquea la cuenta después de 5 intentos fallidos', async () => {
      const userConIntentos = { ...MOCK_USER, intentosFallidos: 4 };
      prisma.usuario.findUnique.mockResolvedValue(userConIntentos);
      prisma.usuario.update.mockResolvedValue({
        ...userConIntentos,
        intentosFallidos: 5,
        bloqueadoHasta: new Date(Date.now() + 30 * 60 * 1000),
      });

      await expect(service.validateUser('carlos@clinica.mx', 'WrongPass!'))
        .rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException si la cuenta está bloqueada', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...MOCK_USER,
        bloqueadoHasta: new Date(Date.now() + 15 * 60 * 1000),
      });

      await expect(service.validateUser('carlos@clinica.mx', PASSWORD))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ─── login ─────────────────────────────────────────────
  describe('login', () => {
    it('retorna tokens cuando MFA está desactivado', async () => {
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.usuario.update.mockResolvedValue(MOCK_USER);
      prisma.auditoria.create.mockResolvedValue({});

      const result = await service.login(MOCK_USER, '192.168.1.1', 'Test Browser');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('carlos@clinica.mx');
    });

    it('retorna mfaRequired cuando MFA está activo', async () => {
      const userConMfa = { ...MOCK_USER, mfaActivo: true };
      const result = await service.login(userConMfa, '192.168.1.1', 'Test Browser');

      expect(result.mfaRequired).toBe(true);
      expect(result).toHaveProperty('mfaToken');
    });
  });

  // ─── verifyMfa ──────────────────────────────────────────
  describe('verifyMfa', () => {
    it('verifica código TOTP válido y retorna tokens', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);

      prisma.usuario.findUniqueOrThrow.mockResolvedValue({
        ...MOCK_USER,
        mfaActivo: true,
        mfaSecret: Buffer.from(`testkey:${secret}`).toString('base64'),
        mfaBackupCodes: [],
      });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.usuario.update.mockResolvedValue(MOCK_USER);
      prisma.auditoria.create.mockResolvedValue({});

      const result = await service.verifyMfa(MOCK_USER.id, validCode, '127.0.0.1', 'Test');
      expect(result).toHaveProperty('accessToken');
    });

    it('lanza UnauthorizedException con código MFA inválido', async () => {
      prisma.usuario.findUniqueOrThrow.mockResolvedValue({
        ...MOCK_USER,
        mfaActivo: true,
        mfaSecret: Buffer.from('testkey:INVALIDSECRET').toString('base64'),
        mfaBackupCodes: [],
      });

      await expect(service.verifyMfa(MOCK_USER.id, '000000', '127.0.0.1', 'Test'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('acepta backup code válido y lo consume', async () => {
      const backupCode = 'ABCD1234';
      prisma.usuario.findUniqueOrThrow.mockResolvedValue({
        ...MOCK_USER,
        mfaActivo: true,
        mfaSecret: Buffer.from('testkey:INVALIDSECRET').toString('base64'),
        mfaBackupCodes: [backupCode, 'OTHER567'],
      });
      prisma.usuario.update.mockResolvedValue(MOCK_USER);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditoria.create.mockResolvedValue({});

      const result = await service.verifyMfa(MOCK_USER.id, backupCode, '127.0.0.1', 'Test');
      expect(result).toHaveProperty('accessToken');
      // Verificar que el backup code fue removido
      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mfaBackupCodes: ['OTHER567'] }),
        }),
      );
    });
  });

  // ─── refreshToken ────────────────────────────────────────
  describe('refreshToken', () => {
    it('rota el refresh token y retorna nuevo par', async () => {
      const oldToken = 'old-refresh-token';
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-001',
        token: oldToken,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usuario: MOCK_USER,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.usuario.update.mockResolvedValue(MOCK_USER);
      prisma.auditoria.create.mockResolvedValue({});

      const result = await service.refreshToken(oldToken, '127.0.0.1', 'Test');
      expect(result).toHaveProperty('accessToken');
      // El token anterior debe revocarse
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      );
    });

    it('rechaza refresh token revocado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-001',
        token: 'revoked-token',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usuario: MOCK_USER,
      });

      await expect(service.refreshToken('revoked-token', '127.0.0.1', 'Test'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('rechaza refresh token expirado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-001',
        token: 'expired-token',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // expirado
        usuario: MOCK_USER,
      });

      await expect(service.refreshToken('expired-token', '127.0.0.1', 'Test'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── logout ─────────────────────────────────────────────
  describe('logout', () => {
    it('revoca el refresh token al hacer logout', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
