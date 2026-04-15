// ═══════════════════════════════════════════════════════════
// DATABASE SEED — SGCI
// Especialidades · CIE-10 · Medicamentos COFEPRIS
// Servicios SAT · Instrumentos AUDIT/DAST · Sede demo
// ═══════════════════════════════════════════════════════════
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos SGCI...');

  // ─── Especialidades ─────────────────────────────────────
  const especialidades = await Promise.all([
    prisma.especialidad.upsert({ where: { clave: 'MED_GRAL' }, update: {}, create: { clave: 'MED_GRAL', nombre: 'Medicina General', descripcion: 'Atención médica general' } }),
    prisma.especialidad.upsert({ where: { clave: 'PSIQUIATRIA' }, update: {}, create: { clave: 'PSIQUIATRIA', nombre: 'Psiquiatría', descripcion: 'Salud mental y adicciones' } }),
    prisma.especialidad.upsert({ where: { clave: 'PSICOLOGIA' }, update: {}, create: { clave: 'PSICOLOGIA', nombre: 'Psicología Clínica', descripcion: 'Terapia y apoyo psicológico' } }),
    prisma.especialidad.upsert({ where: { clave: 'TRABAJO_SOC' }, update: {}, create: { clave: 'TRABAJO_SOC', nombre: 'Trabajo Social', descripcion: 'Intervención social y familiar' } }),
    prisma.especialidad.upsert({ where: { clave: 'MEDICINA_ADICCIONES' }, update: {}, create: { clave: 'MEDICINA_ADICCIONES', nombre: 'Medicina de Adicciones', descripcion: 'Tratamiento especializado NOM-028' } }),
    prisma.especialidad.upsert({ where: { clave: 'ENFERMERIA' }, update: {}, create: { clave: 'ENFERMERIA', nombre: 'Enfermería', descripcion: 'Atención de enfermería' } }),
    prisma.especialidad.upsert({ where: { clave: 'NUTRICION' }, update: {}, create: { clave: 'NUTRICION', nombre: 'Nutrición', descripcion: 'Evaluación y plan nutricional' } }),
  ]);
  console.log(`✅ ${especialidades.length} especialidades creadas`);

  // ─── Sede demo ──────────────────────────────────────────
  const sede = await prisma.sede.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      nombre: 'Clínica SGCI — Sede Principal',
      razonSocial: 'CLÍNICA INTEGRAL SA DE CV',
      rfc: 'CIN220101ABC',
      direccionFiscal: { calle: 'Av. Principal 123', colonia: 'Centro', ciudad: 'Monterrey', estado: 'Nuevo León', cp: '64000' },
      telefono: '8112345678',
      email: 'contacto@clinicasgci.mx',
    },
  });

  // Horarios de la sede (lunes a viernes 8-20, sábado 8-14)
  const horarios = [1,2,3,4,5].map(d => ({
    sedeId: sede.id, diaSemana: d, horaApertura: '08:00', horaCierre: '20:00', activo: true,
  }));
  horarios.push({ sedeId: sede.id, diaSemana: 6, horaApertura: '08:00', horaCierre: '14:00', activo: true });

  for (const h of horarios) {
    await prisma.horarioSede.upsert({
      where: { id: `${sede.id}-${h.diaSemana}` } as any,
      update: {},
      create: h,
    }).catch(() => null);
  }

  // ─── Usuario superadmin ──────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@SGCI2024!', 12);
  const superadmin = await prisma.usuario.upsert({
    where: { email: 'superadmin@clinicasgci.mx' },
    update: {},
    create: {
      sedeId: sede.id,
      nombre: 'Super',
      apellidoPaterno: 'Administrador',
      email: 'superadmin@clinicasgci.mx',
      passwordHash,
      roles: ['SUPERADMIN'],
      activo: true,
    },
  });
  console.log(`✅ Superadmin creado: superadmin@clinicasgci.mx / Admin@SGCI2024!`);

  // ─── Médico demo ─────────────────────────────────────────
  const medicoUser = await prisma.usuario.upsert({
    where: { email: 'dr.rodriguez@clinicasgci.mx' },
    update: {},
    create: {
      sedeId: sede.id,
      nombre: 'Carlos',
      apellidoPaterno: 'Rodríguez',
      apellidoMaterno: 'López',
      email: 'dr.rodriguez@clinicasgci.mx',
      passwordHash: await bcrypt.hash('Medico@2024!', 12),
      roles: ['MEDICO'],
      activo: true,
    },
  });

  await prisma.medico.upsert({
    where: { usuarioId: medicoUser.id },
    update: {},
    create: {
      usuarioId: medicoUser.id,
      cedulaProfesional: '12345678',
      habilitadoControlados: true,
      foliosCofepris: ['COFEPRIS-2024-001', 'COFEPRIS-2024-002', 'COFEPRIS-2024-003'],
      colorAgenda: '#3B82F6',
      especialidades: {
        create: [
          { especialidadId: especialidades[0].id, esPrincipal: true },
          { especialidadId: especialidades[4].id, esPrincipal: false },
        ],
      },
    },
  });
  console.log('✅ Médico demo creado: dr.rodriguez@clinicasgci.mx');

  // ─── Servicios del catálogo SAT ──────────────────────────
  const servicios = [
    { clave: 'CONSULTA_PRIMERA_VEZ', nombre: 'Consulta de Primera Vez', claveSAT: '93101601', claveUnidadSAT: 'E48', precio: 800, ivaAplicable: false, tasaIva: 0 },
    { clave: 'CONSULTA_SEGUIMIENTO', nombre: 'Consulta de Seguimiento', claveSAT: '93101601', claveUnidadSAT: 'E48', precio: 500, ivaAplicable: false, tasaIva: 0 },
    { clave: 'CONSULTA_EVALUACION_ADICCIONES', nombre: 'Evaluación Integral de Adicciones', claveSAT: '93101601', claveUnidadSAT: 'E48', precio: 1200, ivaAplicable: false, tasaIva: 0 },
    { clave: 'CONSULTA_URGENCIA', nombre: 'Consulta de Urgencias', claveSAT: '93101601', claveUnidadSAT: 'E48', precio: 600, ivaAplicable: false, tasaIva: 0 },
    { clave: 'CONSULTA_TELEMEDICINA', nombre: 'Teleconsulta', claveSAT: '81112001', claveUnidadSAT: 'E48', precio: 450, ivaAplicable: false, tasaIva: 0 },
    { clave: 'SESION_PSICOLOGICA', nombre: 'Sesión Psicológica Individual', claveSAT: '85141700', claveUnidadSAT: 'E48', precio: 600, ivaAplicable: false, tasaIva: 0 },
    { clave: 'SESION_GRUPAL', nombre: 'Sesión Terapéutica Grupal', claveSAT: '85141700', claveUnidadSAT: 'E48', precio: 350, ivaAplicable: false, tasaIva: 0 },
    { clave: 'LAB_BIOMETRIA', nombre: 'Biometría Hemática Completa', claveSAT: '85101500', claveUnidadSAT: 'E48', precio: 180, ivaAplicable: false, tasaIva: 0 },
    { clave: 'LAB_QUIMICA_SANGUINEA_6', nombre: 'Química Sanguínea 6 Elementos', claveSAT: '85101500', claveUnidadSAT: 'E48', precio: 220, ivaAplicable: false, tasaIva: 0 },
    { clave: 'LAB_EXAMEN_GENERAL_ORINA', nombre: 'Examen General de Orina', claveSAT: '85101500', claveUnidadSAT: 'E48', precio: 120, ivaAplicable: false, tasaIva: 0 },
    { clave: 'LAB_DETECCION_DROGAS_5P', nombre: 'Detección de Drogas 5 Paneles', claveSAT: '85101500', claveUnidadSAT: 'E48', precio: 350, ivaAplicable: false, tasaIva: 0 },
    { clave: 'LAB_PERFIL_HEPATICO', nombre: 'Perfil Hepático', claveSAT: '85101500', claveUnidadSAT: 'E48', precio: 280, ivaAplicable: false, tasaIva: 0 },
  ];

  for (const s of servicios) {
    await prisma.servicioCatalogo.upsert({ where: { clave: s.clave }, update: {}, create: s });
  }
  console.log(`✅ ${servicios.length} servicios del catálogo SAT creados`);

  // ─── Estudios de laboratorio ─────────────────────────────
  const estudios = [
    { clave: 'BH', nombre: 'Biometría Hemática Completa', precio: 180, tiempoEntregaHoras: 2 },
    { clave: 'QS6', nombre: 'Química Sanguínea 6 Elementos', precio: 220, tiempoEntregaHoras: 3 },
    { clave: 'EGO', nombre: 'Examen General de Orina', precio: 120, tiempoEntregaHoras: 1 },
    { clave: 'DROGAS5', nombre: 'Detección de Drogas 5 Paneles (Orina)', precio: 350, tiempoEntregaHoras: 1, instruccionesPaciente: 'No orinar 2 horas antes de la toma de muestra.' },
    { clave: 'DROGAS10', nombre: 'Detección de Drogas 10 Paneles (Orina)', precio: 480, tiempoEntregaHoras: 1 },
    { clave: 'PERF_HEP', nombre: 'Perfil Hepático', precio: 280, tiempoEntregaHoras: 3, instruccionesPaciente: 'Ayuno de 8-12 horas.' },
    { clave: 'PERF_LIP', nombre: 'Perfil de Lípidos', precio: 250, tiempoEntregaHoras: 3, instruccionesPaciente: 'Ayuno de 12 horas.' },
    { clave: 'GLUC_EN_AYUNAS', nombre: 'Glucosa en Ayunas', precio: 80, tiempoEntregaHoras: 1, instruccionesPaciente: 'Ayuno de 8 horas.' },
    { clave: 'TSH', nombre: 'TSH (Tiroides)', precio: 320, tiempoEntregaHoras: 4 },
    { clave: 'VIH', nombre: 'Prueba VIH/SIDA', precio: 180, tiempoEntregaHoras: 2 },
  ];

  for (const e of estudios) {
    await prisma.estudioLab.upsert({ where: { clave: e.clave }, update: {}, create: e });
  }
  console.log(`✅ ${estudios.length} estudios de laboratorio creados`);

  // ─── Instrumentos de evaluación de adicciones ────────────
  const instrumentos = [
    {
      nombre: 'AUDIT',
      descripcion: 'Alcohol Use Disorders Identification Test (OMS)',
      preguntas: [
        { id: 1, texto: '¿Con qué frecuencia consume alcohol?', opciones: [{ valor: 0, texto: 'Nunca', puntaje: 0 }, { valor: 1, texto: 'Mensualmente', puntaje: 1 }, { valor: 2, texto: '2-4 veces/mes', puntaje: 2 }, { valor: 3, texto: '2-3 veces/semana', puntaje: 3 }, { valor: 4, texto: '4+ veces/semana', puntaje: 4 }] },
        { id: 2, texto: '¿Cuántas bebidas consume en un día típico?', opciones: [{ valor: 0, texto: '1-2', puntaje: 0 }, { valor: 1, texto: '3-4', puntaje: 1 }, { valor: 2, texto: '5-6', puntaje: 2 }, { valor: 3, texto: '7-9', puntaje: 3 }, { valor: 4, texto: '10+', puntaje: 4 }] },
        { id: 3, texto: '¿Con qué frecuencia toma 6+ bebidas en una sola ocasión?', opciones: [{ valor: 0, texto: 'Nunca', puntaje: 0 }, { valor: 1, texto: 'Menos de mensual', puntaje: 1 }, { valor: 2, texto: 'Mensualmente', puntaje: 2 }, { valor: 3, texto: 'Semanalmente', puntaje: 3 }, { valor: 4, texto: 'Diariamente', puntaje: 4 }] },
        // ... preguntas 4-10 omitidas por brevedad en el seed
      ],
      criterios: {
        bajo: { minimo: 0, maximo: 7, descripcion: 'Consumo de bajo riesgo o bebedor social' },
        moderado: { minimo: 8, maximo: 15, descripcion: 'Consumo problemático — intervención breve recomendada' },
        alto: { minimo: 16, maximo: 19, descripcion: 'Consumo dañino — referir a tratamiento' },
        dependencia: { minimo: 20, maximo: 40, descripcion: 'Probable dependencia — tratamiento especializado urgente' },
      },
    },
    {
      nombre: 'DAST-10',
      descripcion: 'Drug Abuse Screening Test (10 ítems)',
      preguntas: [
        { id: 1, texto: '¿Ha usado drogas que no eran recetadas o en cantidades mayores a las recetadas?', opciones: [{ valor: 0, texto: 'No', puntaje: 0 }, { valor: 1, texto: 'Sí', puntaje: 1 }] },
        { id: 2, texto: '¿Ha abusado de drogas recetadas?', opciones: [{ valor: 0, texto: 'No', puntaje: 0 }, { valor: 1, texto: 'Sí', puntaje: 1 }] },
        // ... ítems 3-10
      ],
      criterios: {
        sin_problema: { minimo: 0, maximo: 0, descripcion: 'Sin problemas relacionados con drogas' },
        leve: { minimo: 1, maximo: 2, descripcion: 'Grado leve de problemas relacionados con drogas' },
        moderado: { minimo: 3, maximo: 5, descripcion: 'Grado moderado — se recomienda valoración adicional' },
        considerable: { minimo: 6, maximo: 8, descripcion: 'Grado considerable — tratamiento especializado' },
        grave: { minimo: 9, maximo: 10, descripcion: 'Grado grave — tratamiento intensivo urgente' },
      },
    },
    {
      nombre: 'CAGE',
      descripcion: 'CAGE Questionnaire — Detección rápida de alcoholismo (4 preguntas)',
      preguntas: [
        { id: 1, texto: '¿Ha sentido alguna vez que debe beber menos?', opciones: [{ valor: 0, texto: 'No', puntaje: 0 }, { valor: 1, texto: 'Sí', puntaje: 1 }] },
        { id: 2, texto: '¿Le ha molestado que la gente critique su forma de beber?', opciones: [{ valor: 0, texto: 'No', puntaje: 0 }, { valor: 1, texto: 'Sí', puntaje: 1 }] },
        { id: 3, texto: '¿Alguna vez se ha sentido culpable por beber?', opciones: [{ valor: 0, texto: 'No', puntaje: 0 }, { valor: 1, texto: 'Sí', puntaje: 1 }] },
        { id: 4, texto: '¿Alguna vez ha necesitado un trago de mañana para calmarse?', opciones: [{ valor: 0, texto: 'No', puntaje: 0 }, { valor: 1, texto: 'Sí', puntaje: 1 }] },
      ],
      criterios: {
        bajo: { minimo: 0, maximo: 1, descripcion: 'Consumo de bajo riesgo' },
        moderado: { minimo: 2, maximo: 3, descripcion: 'Posible abuso de alcohol — evaluación adicional' },
        alto: { minimo: 4, maximo: 4, descripcion: 'Alta probabilidad de dependencia alcohólica' },
      },
    },
  ];

  for (const instr of instrumentos) {
    await prisma.instrumento.upsert({
      where: { nombre: instr.nombre },
      update: {},
      create: {
        nombre: instr.nombre,
        descripcion: instr.descripcion,
        preguntas: instr.preguntas as any,
        criterios: instr.criterios as any,
      },
    });
  }
  console.log(`✅ ${instrumentos.length} instrumentos de evaluación creados`);

  // ─── Códigos CIE-10 más comunes en adicciones ─────────────
  const cie10 = [
    { codigo: 'F10', descripcion: 'Trastornos mentales y del comportamiento debidos al uso del alcohol', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F10.1', descripcion: 'Uso nocivo del alcohol', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F10.2', descripcion: 'Síndrome de dependencia al alcohol', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F10.3', descripcion: 'Estado de abstinencia de alcohol', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F11', descripcion: 'Trastornos debidos al uso de opioides', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F12', descripcion: 'Trastornos debidos al uso de cannabinoides', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F14', descripcion: 'Trastornos debidos al uso de cocaína', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F15', descripcion: 'Trastornos debidos al uso de otros estimulantes (metanfetamina)', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'F19', descripcion: 'Trastornos debidos al uso de múltiples drogas y otras sustancias', capitulo: 'V', bloque: 'F10-F19' },
    { codigo: 'J06.9', descripcion: 'Infección aguda de las vías respiratorias superiores, no especificada', capitulo: 'X', bloque: 'J00-J06' },
    { codigo: 'K29.7', descripcion: 'Gastritis, no especificada', capitulo: 'XI', bloque: 'K25-K31' },
    { codigo: 'E11', descripcion: 'Diabetes mellitus no insulinodependiente', capitulo: 'IV', bloque: 'E10-E14' },
    { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)', capitulo: 'IX', bloque: 'I10-I15' },
    { codigo: 'F32.0', descripcion: 'Episodio depresivo leve', capitulo: 'V', bloque: 'F30-F39' },
    { codigo: 'F41.1', descripcion: 'Trastorno de ansiedad generalizada', capitulo: 'V', bloque: 'F40-F48' },
  ];

  for (const c of cie10) {
    await prisma.codigoCIE10.upsert({ where: { codigo: c.codigo }, update: {}, create: c });
  }
  console.log(`✅ ${cie10.length} códigos CIE-10 creados`);

  // ─── Medicamentos controlados frecuentes ─────────────────
  const medicamentos = [
    { claveCofepris: 'CLOFE-001', nombreDci: 'Clonazepam', nombreComercial: 'Rivotril', presentacion: 'Tabletas 0.5mg, 2mg', viaAdministracion: 'Oral', esControlado: true, tipoReceta: 'ESPECIAL' as any },
    { claveCofepris: 'ALPRA-001', nombreDci: 'Alprazolam', nombreComercial: 'Tafil', presentacion: 'Tabletas 0.25mg, 0.5mg, 1mg', viaAdministracion: 'Oral', esControlado: true, tipoReceta: 'ESPECIAL' as any },
    { claveCofepris: 'BUPRE-001', nombreDci: 'Buprenorfina', nombreComercial: 'Subutex', presentacion: 'Tabletas sublinguales 2mg, 8mg', viaAdministracion: 'Sublingual', esControlado: true, tipoReceta: 'ESTUPEFACIENTE' as any },
    { claveCofepris: 'METAD-001', nombreDci: 'Metadona', nombreComercial: 'Metadona', presentacion: 'Solución oral 10mg/mL', viaAdministracion: 'Oral', esControlado: true, tipoReceta: 'ESTUPEFACIENTE' as any },
    { claveCofepris: 'NALT-001', nombreDci: 'Naltrexona', nombreComercial: 'Revia', presentacion: 'Tabletas 50mg', viaAdministracion: 'Oral', esControlado: false, tipoReceta: 'ORDINARIA' as any },
    { claveCofepris: 'ACAM-001', nombreDci: 'Acamprosato', nombreComercial: 'Campral', presentacion: 'Comprimidos 333mg', viaAdministracion: 'Oral', esControlado: false, tipoReceta: 'ORDINARIA' as any },
    { claveCofepris: 'DISUL-001', nombreDci: 'Disulfiram', nombreComercial: 'Antabuse', presentacion: 'Tabletas 250mg, 500mg', viaAdministracion: 'Oral', esControlado: false, tipoReceta: 'ORDINARIA' as any },
    { claveCofepris: 'FLUO-001', nombreDci: 'Fluoxetina', nombreComercial: 'Prozac', presentacion: 'Cápsulas 20mg', viaAdministracion: 'Oral', esControlado: false, tipoReceta: 'ORDINARIA' as any },
    { claveCofepris: 'SERT-001', nombreDci: 'Sertralina', nombreComercial: 'Zoloft', presentacion: 'Tabletas 50mg, 100mg', viaAdministracion: 'Oral', esControlado: false, tipoReceta: 'ORDINARIA' as any },
    { claveCofepris: 'QUETI-001', nombreDci: 'Quetiapina', nombreComercial: 'Seroquel', presentacion: 'Tabletas 25mg, 50mg, 100mg', viaAdministracion: 'Oral', esControlado: false, tipoReceta: 'ORDINARIA' as any },
  ];

  for (const m of medicamentos) {
    await prisma.medicamento.upsert({ where: { claveCofepris: m.claveCofepris }, update: {}, create: m });
  }
  console.log(`✅ ${medicamentos.length} medicamentos creados`);

  console.log('\n🎉 Seed completado exitosamente');
  console.log('\n📋 Credenciales de acceso:');
  console.log('   Superadmin: superadmin@clinicasgci.mx / Admin@SGCI2024!');
  console.log('   Médico demo: dr.rodriguez@clinicasgci.mx / Medico@2024!');
  console.log('\n🔗 Accesos:');
  console.log('   API: http://localhost:4000/api/v1');
  console.log('   Swagger: http://localhost:4000/api/docs');
  console.log('   MinIO Console: http://localhost:9001');
  console.log('   RabbitMQ: http://localhost:15672');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
