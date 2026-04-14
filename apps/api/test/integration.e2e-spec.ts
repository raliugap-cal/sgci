// ═══════════════════════════════════════════════════════════
// TEST DE INTEGRACIÓN — flujo completo SGCI
// Registro paciente → cita → consulta → nota → factura
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcryptjs';

describe('SGCI — Flujo de integración completo', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let sedeId: string;
  let medicoId: string;
  let pacienteId: string;
  let citaId: string;
  let consultaId: string;
  let notaId: string;
  let facturaId: string;

  // ─── Setup ────────────────────────────────────────────────
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
    await setupTestData();
  });

  afterAll(async () => {
    await teardown();
    await app.close();
  });

  async function setupTestData() {
    // Crear sede de prueba
    const sede = await prisma.sede.create({
      data: {
        nombre: 'Sede Test E2E',
        razonSocial: 'CLINICA TEST SA DE CV',
        rfc: 'CTE240101TST',
        direccionFiscal: { calle: 'Test 123', cp: '64000' },
      },
    });
    sedeId = sede.id;

    // Crear usuario médico de prueba
    const usuario = await prisma.usuario.create({
      data: {
        sedeId,
        nombre: 'Carlos',
        apellidoPaterno: 'Test',
        email: 'medico.test.e2e@sgci.test',
        passwordHash: await bcrypt.hash('TestPass@2024!', 10),
        roles: ['MEDICO'],
      },
    });

    const medico = await prisma.medico.create({
      data: {
        usuarioId: usuario.id,
        cedulaProfesional: '99999999',
        habilitadoControlados: false,
      },
    });
    medicoId = medico.id;

    // Horario de la sede
    await prisma.horarioSede.create({
      data: { sedeId, diaSemana: 1, horaApertura: '08:00', horaCierre: '20:00', activo: true },
    });
  }

  async function teardown() {
    // Limpiar en orden por integridad referencial
    await prisma.auditoria.deleteMany({ where: { sedeId } });
    await prisma.notaClinica.deleteMany({ where: { consulta: { sedeId } } });
    await prisma.signosVitales.deleteMany({ where: { consulta: { sedeId } } });
    await prisma.consulta.deleteMany({ where: { sedeId } });
    await prisma.cita.deleteMany({ where: { sedeId } });
    await prisma.factura.deleteMany({ where: { sedeId } });
    await prisma.consentimiento.deleteMany({ where: { paciente: { sedeId } } });
    await prisma.paciente.deleteMany({ where: { sedeId } });
    await prisma.medico.deleteMany({ where: { usuarioId: { in: (await prisma.usuario.findMany({ where: { sedeId }, select: { id: true } })).map(u => u.id) } } });
    await prisma.usuario.deleteMany({ where: { sedeId } });
    await prisma.horarioSede.deleteMany({ where: { sedeId } });
    await prisma.sede.deleteMany({ where: { id: sedeId } });
  }

  // ─── 1. Autenticación ─────────────────────────────────────
  describe('1 — Autenticación', () => {
    it('POST /auth/login — login exitoso sin MFA', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Sede-Id', sedeId)
        .send({ email: 'medico.test.e2e@sgci.test', password: 'TestPass@2024!' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.mfaRequired).toBeFalsy();
      expect(res.body.user.roles).toContain('MEDICO');
      accessToken = res.body.accessToken;
    });

    it('POST /auth/login — rechaza credenciales inválidas', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'medico.test.e2e@sgci.test', password: 'WrongPassword!' })
        .expect(401);
    });

    it('GET /auth/me — retorna perfil del usuario autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body.roles).toContain('MEDICO');
    });
  });

  // ─── 2. Registro de paciente ─────────────────────────────
  describe('2 — Registro de paciente', () => {
    it('POST /patients — registra paciente con datos válidos', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({
          nombre: 'María',
          apellidoPaterno: 'González',
          apellidoMaterno: 'López',
          fechaNacimiento: '1985-03-20',
          sexo: 'FEMENINO',
          curp: 'GOLM850320MDFNPR09',
          email: 'maria.test@example.com',
          telefono: '5512345678',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('numeroExpediente');
      expect(res.body.nombre).toBe('María');
      pacienteId = res.body.id;
    });

    it('POST /patients — rechaza CURP duplicada', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({
          nombre: 'Pedro',
          apellidoPaterno: 'Test',
          fechaNacimiento: '1990-01-01',
          sexo: 'MASCULINO',
          curp: 'GOLM850320MDFNPR09', // Misma CURP
        })
        .expect(409);
    });

    it('GET /patients/:id — retorna expediente con campos descifrados', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${pacienteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body.nombre).toBe('María');
      expect(res.body.curp).toBe('GOLM850320MDFNPR09');
    });

    it('GET /patients — busca por nombre', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients?q=María&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty('total');
    });
  });

  // ─── 3. Agenda y citas ────────────────────────────────────
  describe('3 — Agenda y citas', () => {
    it('GET /appointments/availability — retorna slots disponibles', async () => {
      const fechaManana = new Date();
      fechaManana.setDate(fechaManana.getDate() + 1);
      const fechaStr = fechaManana.toISOString().substring(0, 10);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/availability?medicoId=${medicoId}&fecha=${fechaStr}&tipoCita=SEGUIMIENTO`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body).toHaveProperty('slots');
      expect(Array.isArray(res.body.slots)).toBe(true);
    });

    it('POST /appointments — crea cita exitosamente', async () => {
      const fechaManana = new Date();
      fechaManana.setDate(fechaManana.getDate() + 1);
      fechaManana.setHours(10, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({
          pacienteId,
          medicoId,
          tipoCita: 'SEGUIMIENTO',
          fechaInicio: fechaManana.toISOString(),
          motivoConsulta: 'Seguimiento de tratamiento',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.estado).toBe('CONFIRMADA');
      citaId = res.body.id;
    });

    it('POST /appointments/:id/checkin — registra llegada del paciente', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${citaId}/checkin`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({})
        .expect(200);

      expect(res.body.estado).toBe('EN_ESPERA');
    });
  });

  // ─── 4. Consulta y HCE ────────────────────────────────────
  describe('4 — Consulta y HCE', () => {
    it('POST /hce/consultas — abre consulta desde cita', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/hce/consultas')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({ citaId })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.estado).toBe('EN_PROGRESO');
      consultaId = res.body.id;
    });

    it('POST /hce/vitals — registra signos vitales', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/hce/vitals')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({
          consultaId,
          pesoKg: 62.5,
          tallaCm: 165,
          taSistolica: 120,
          taDiastolica: 80,
          fcLpm: 72,
          temperaturaC: 36.5,
        })
        .expect(201);
    });

    it('POST /hce/notas — crea nota SOAP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/hce/notas')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({
          consultaId,
          tipoNota: 'SOAP',
          subjetivo: 'Paciente refiere mejoría general.',
          objetivo: 'TA 120/80, FC 72lpm, T° 36.5°C.',
          evaluacion: 'Seguimiento sin complicaciones.',
          plan: 'Continuar tratamiento actual.',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      notaId = res.body.id;
    });

    it('POST /hce/notas/:id/sign — firma la nota', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/hce/notas/${notaId}/sign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body.firmada).toBe(true);
      expect(res.body.firmaHash).toBeDefined();
    });

    it('PATCH /hce/notas/:id — rechaza edición de nota firmada', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/hce/notas/${notaId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({ subjetivo: 'Intento de modificación' })
        .expect(403);
    });

    it('GET /hce/cie10/search — busca códigos CIE-10', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/hce/cie10/search?q=F10')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /hce/consultas/:id/close — cierra la consulta firmada', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/hce/consultas/${consultaId}/close`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body.estado).toBe('FIRMADA');
    });
  });

  // ─── 5. Facturación ───────────────────────────────────────
  describe('5 — Facturación CFDI', () => {
    it('POST /billing/invoices — crea pre-factura vinculada a consulta', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({ pacienteId, consultaId })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.estadoCfdi).toBe('BORRADOR');
      facturaId = res.body.id;
    });

    it('POST /billing/invoices/:id/charges — agrega cargo a la factura', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/billing/invoices/${facturaId}/charges`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .send({
          concepto: 'Consulta de seguimiento',
          claveSAT: '93101601',
          claveUnidadSAT: 'E48',
          precioUnitario: 500,
          cantidad: 1,
          ivaAplicable: false,
        })
        .expect(201);

      expect(Number(res.body.total)).toBe(500);
    });

    it('GET /billing/invoices/:id — retorna detalle de factura', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${facturaId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body.cargos).toHaveLength(1);
      expect(res.body.estadoCfdi).toBe('BORRADOR');
    });
  });

  // ─── 6. Sync offline ─────────────────────────────────────
  describe('6 — Sincronización offline', () => {
    it('GET /sync/prefetch/:pacienteId — retorna datos para precarga', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/sync/prefetch/${pacienteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Sede-Id', sedeId)
        .expect(200);

      expect(res.body).toHaveProperty('citas');
      expect(res.body).toHaveProperty('alergias');
      expect(res.body).toHaveProperty('generadoAt');
    });

    it('POST /sync/patient — sincroniza diario offline del paciente', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sync/patient')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          pacienteId,
          lastSyncAt: new Date(0).toISOString(),
          deviceId: 'test-device-001',
          diaryEntries: [],
          messages: [],
        })
        .expect(200);

      expect(res.body).toHaveProperty('serverChanges');
      expect(res.body).toHaveProperty('syncedAt');
    });
  });

  // ─── 7. Health check ──────────────────────────────────────
  describe('7 — Health & monitoring', () => {
    it('GET /health — retorna estado ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.checks.postgres.status).toBe('ok');
    });

    it('GET /health/live — liveness probe ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });
  });
});
