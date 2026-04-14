import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // ─── Seguridad HTTP ────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(compression());

  // ─── CORS ──────────────────────────────────────────────────
  app.enableCors({
    origin: [
      'http://localhost:3000',  // Web staff
      'http://localhost:3001',  // Portal paciente
      ...(configService.get<string>('CORS_ORIGINS', '').split(',').filter(Boolean)),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Sede-Id', 'X-Device-Id', 'X-Trace-Id'],
    exposedHeaders: ['X-Trace-Id'],
  });

  // ─── Prefijo global de API ─────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Validación global ─────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Filtros e interceptores globales ──────────────────────
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new AuditInterceptor(),
  );

  // ─── Swagger (solo en desarrollo) ─────────────────────────
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SGCI — Sistema de Gestión Clínica Integral')
      .setDescription('API REST · NOM-004 · NOM-028 · CFDI 4.0 · LFPDPPP')
      .setVersion('2.1')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Sede-Id' }, 'SedeId')
      .addTag('auth', 'Autenticación y sesiones')
      .addTag('patients', 'Pacientes (NOM-004 + LFPDPPP)')
      .addTag('appointments', 'Agenda y citas')
      .addTag('consultations', 'Consultas y HCE (NOM-004)')
      .addTag('addictions', 'Adicciones (NOM-028)')
      .addTag('lab', 'Laboratorio interno')
      .addTag('prescriptions', 'Recetas (COFEPRIS)')
      .addTag('billing', 'Facturación CFDI 4.0')
      .addTag('notifications', 'Notificaciones')
      .addTag('reports', 'Reportes y analítica')
      .addTag('admin', 'Administración')
      .addTag('sync', 'Sincronización offline')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`📚 Swagger disponible en: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`🚀 SGCI API corriendo en: http://localhost:${port}/api/v1`);
  logger.log(`🏥 Entorno: ${nodeEnv}`);
}

bootstrap();
