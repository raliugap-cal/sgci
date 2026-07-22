-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPERADMIN', 'ADMIN_SEDE', 'MEDICO', 'PSICOLOGO', 'ENFERMERIA', 'TRABAJO_SOCIAL', 'RECEPCION', 'LABORATORIO', 'CAJA', 'PACIENTE');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PROGRAMADA', 'CONFIRMADA', 'EN_ESPERA', 'EN_CONSULTA', 'COMPLETADA', 'CANCELADA', 'NO_SHOW', 'REAGENDADA');

-- CreateEnum
CREATE TYPE "TipoCita" AS ENUM ('PRIMERA_VEZ', 'SEGUIMIENTO', 'URGENCIA', 'TELEMEDICINA', 'PROCEDIMIENTO', 'EVALUACION_ADICCIONES', 'SESION_GRUPAL', 'SESION_FAMILIAR');

-- CreateEnum
CREATE TYPE "EstadoConsulta" AS ENUM ('ABIERTA', 'EN_PROGRESO', 'CERRADA', 'FIRMADA');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('SOAP', 'EVOLUCION', 'ENFERMERIA', 'INTERCONSULTA', 'ALTA', 'URGENCIAS', 'PSICOLOGICA', 'TRABAJO_SOCIAL', 'SESION_GRUPAL');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('EMITIDA', 'EN_ESPERA_MUESTRA', 'MUESTRA_TOMADA', 'EN_PROCESAMIENTO', 'RESULTADO_CAPTURADO', 'LIBERADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoReceta" AS ENUM ('ORDINARIA', 'ESPECIAL', 'ESTUPEFACIENTE');

-- CreateEnum
CREATE TYPE "EstadoReceta" AS ENUM ('ACTIVA', 'DISPENSADA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoCFDI" AS ENUM ('BORRADOR', 'TIMBRADO', 'CANCELADO', 'CANCELACION_PENDIENTE');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO_PARCIAL', 'PAGADO', 'DEVUELTO');

-- CreateEnum
CREATE TYPE "MetodoPagoSAT" AS ENUM ('EFECTIVO', 'CHEQUE', 'TRANSFERENCIA', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'CREDITO_INTERNO');

-- CreateEnum
CREATE TYPE "TipoConsentimiento" AS ENUM ('GENERAL_TRATAMIENTO', 'PRIVACIDAD_LFPDPPP', 'ADICCIONES_NOM028', 'TELEMEDICINA', 'CIRUGIA_PROCEDIMIENTO', 'MENOR_EDAD', 'GRABACION_VIDEO');

-- CreateEnum
CREATE TYPE "ModalidadTratamiento" AS ENUM ('AMBULATORIO', 'HOSPITAL_DIA', 'RESIDENCIAL', 'GRUPAL');

-- CreateEnum
CREATE TYPE "EstadoTratamiento" AS ENUM ('EN_EVALUACION', 'EN_TRATAMIENTO', 'SUSPENSION_TEMPORAL', 'ALTA_TERAPEUTICA', 'ALTA_VOLUNTARIA', 'CANALIZADO', 'ABANDONO');

-- CreateEnum
CREATE TYPE "SexoBiologico" AS ENUM ('MASCULINO', 'FEMENINO', 'INTERSEX');

-- CreateEnum
CREATE TYPE "GrupoSanguineo" AS ENUM ('A_POSITIVO', 'A_NEGATIVO', 'B_POSITIVO', 'B_NEGATIVO', 'AB_POSITIVO', 'AB_NEGATIVO', 'O_POSITIVO', 'O_NEGATIVO', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "NivelAlerta" AS ENUM ('P1', 'P2', 'P3');

-- CreateTable
CREATE TABLE "especialidades" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "especialidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medico_sedes" (
    "medico_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_sede_base" BOOLEAN NOT NULL DEFAULT false,
    "asignado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medico_sedes_pkey" PRIMARY KEY ("medico_id","sede_id")
);

-- CreateTable
CREATE TABLE "medicamentos" (
    "id" TEXT NOT NULL,
    "clave_cofepris" TEXT NOT NULL,
    "nombre_dci" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "presentacion" TEXT,
    "via_administracion" TEXT,
    "grupo_terapeutico" TEXT,
    "es_controlado" BOOLEAN NOT NULL DEFAULT false,
    "tipo_receta" "TipoReceta",
    "dosis_maxima_diaria" TEXT,
    "contraindicaciones" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_cie10" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "capitulo" TEXT,
    "bloque" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "codigos_cie10_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudios_lab" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "instrucciones_paciente" TEXT,
    "tiempo_entrega_horas" INTEGER,
    "precio" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudios_lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrumentos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "preguntas" JSONB NOT NULL,
    "criterios" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "instrumentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios_catalogo" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "clave_sat" TEXT NOT NULL,
    "clave_unidad_sat" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "iva_aplicable" BOOLEAN NOT NULL DEFAULT false,
    "tasa_iva" DECIMAL(5,4) NOT NULL DEFAULT 0.00,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sedes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "rfc" TEXT NOT NULL,
    "direccion_fiscal" JSONB NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "licencia_sanitaria" TEXT,
    "csd_certificado" TEXT,
    "csd_llave" TEXT,
    "csd_contrasena" TEXT,
    "pac_url" TEXT,
    "pac_user" TEXT,
    "pac_pass" TEXT,
    "daily_api_key" TEXT,
    "whatsapp_phone_number_id" TEXT,
    "whatsapp_access_token" TEXT,
    "qb_realm_id" TEXT,
    "qb_access_token" TEXT,
    "qb_refresh_token" TEXT,
    "qb_token_expiry" TIMESTAMP(3),
    "config_json" JSONB,
    "logo_url" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "actor_id" TEXT,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_sede" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora_apertura" TEXT NOT NULL,
    "hora_cierre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "horarios_sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT NOT NULL,
    "apellido_materno" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "curp" TEXT,
    "roles" "Rol"[],
    "mfa_activo" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "mfa_backup_codes" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "sesiones_activas" INTEGER NOT NULL DEFAULT 0,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cedula_profesional" TEXT NOT NULL,
    "universidad" TEXT,
    "firma_imagen_url" TEXT,
    "habilitado_controlados" BOOLEAN NOT NULL DEFAULT false,
    "folios_cofepris" TEXT[],
    "color_agenda" TEXT NOT NULL DEFAULT '#3B82F6',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medico_especialidades" (
    "medico_id" TEXT NOT NULL,
    "especialidad_id" TEXT NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "asignada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medico_especialidades_pkey" PRIMARY KEY ("medico_id","especialidad_id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "numero_expediente" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT NOT NULL,
    "apellido_materno" TEXT,
    "fecha_nacimiento" TIMESTAMP(3) NOT NULL,
    "sexo" "SexoBiologico" NOT NULL,
    "genero_identidad" TEXT,
    "curp" BYTEA,
    "rfc" BYTEA,
    "regimen_fiscal" TEXT,
    "uso_cfdi" TEXT,
    "email_cifrado" BYTEA,
    "telefono_cifrado" BYTEA,
    "whatsapp_cifrado" BYTEA,
    "preferencia_mensajeria" TEXT NOT NULL DEFAULT 'whatsapp',
    "direccion" JSONB,
    "grupo_sanguineo" "GrupoSanguineo" NOT NULL DEFAULT 'DESCONOCIDO',
    "estado_civil" TEXT,
    "ocupacion" TEXT,
    "escolaridad" TEXT,
    "religion" TEXT,
    "tiene_expediente_adicciones" BOOLEAN NOT NULL DEFAULT false,
    "portal_activado" BOOLEAN NOT NULL DEFAULT false,
    "portal_password_hash" TEXT,
    "portal_ultimo_acceso" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimientos" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" "TipoConsentimiento" NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "texto_snapshot" TEXT NOT NULL,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "firma_base64" TEXT,
    "ip_firma" TEXT,
    "firmado_por_id" TEXT,
    "firmado_at" TIMESTAMP(3),
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alergias" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "agente" TEXT NOT NULL,
    "reaccion" TEXT,
    "severidad" TEXT,
    "verificada" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alergias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antecedentes" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "antecedentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueos_agenda" (
    "id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueos_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citas" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "tipo_cita" "TipoCita" NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PROGRAMADA',
    "es_telemedicina" BOOLEAN NOT NULL DEFAULT false,
    "daily_room_url" TEXT,
    "daily_room_token" TEXT,
    "daily_room_name" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "motivo_consulta" TEXT,
    "notas_recepcion" TEXT,
    "recordatorio_24h_enviado" BOOLEAN NOT NULL DEFAULT false,
    "recordatorio_2h_enviado" BOOLEAN NOT NULL DEFAULT false,
    "recordatorio_24h_at" TIMESTAMP(3),
    "recordatorio_2h_at" TIMESTAMP(3),
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "cancelada_motivo" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lista_espera" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "medico_id" TEXT,
    "sede_id" TEXT NOT NULL,
    "tipo_cita" "TipoCita" NOT NULL,
    "motivo" TEXT,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lista_espera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas" (
    "id" TEXT NOT NULL,
    "cita_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "es_telemedicina" BOOLEAN NOT NULL DEFAULT false,
    "daily_session_id" TEXT,
    "duracion_video_min" INTEGER,
    "estado" "EstadoConsulta" NOT NULL DEFAULT 'ABIERTA',
    "inicio_atencion" TIMESTAMP(3),
    "fin_atencion" TIMESTAMP(3),
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_clinicas" (
    "id" TEXT NOT NULL,
    "especialidad_id" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo_nota" "TipoNota" NOT NULL,
    "contenido" JSONB NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_clinicas" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "plantilla_id" TEXT,
    "tipo_nota" "TipoNota" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "es_telemedicina" BOOLEAN NOT NULL DEFAULT false,
    "padecimiento_actual" TEXT,
    "interrogatorio_sistemas" TEXT,
    "exploracion_fisica" TEXT,
    "resultados_auxiliares" TEXT,
    "diagnostico_impresion" TEXT,
    "pronostico" TEXT,
    "plan_terapeutico" TEXT,
    "subjetivo" TEXT,
    "objetivo" TEXT,
    "evaluacion" TEXT,
    "plan" TEXT,
    "firmada" BOOLEAN NOT NULL DEFAULT false,
    "firma_hash" TEXT,
    "firmada_at" TIMESTAMP(3),
    "sync_pending" BOOLEAN NOT NULL DEFAULT false,
    "creada_offline" BOOLEAN NOT NULL DEFAULT false,
    "device_id" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versiones_nota" (
    "id" TEXT NOT NULL,
    "nota_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contenido" JSONB NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versiones_nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signos_vitales" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT NOT NULL,
    "capturado_por_id" TEXT NOT NULL,
    "peso_kg" DECIMAL(5,2),
    "talla_cm" DECIMAL(5,2),
    "imc" DECIMAL(5,2),
    "ta_sistolica" INTEGER,
    "ta_diastolica" INTEGER,
    "fc_lpm" INTEGER,
    "fr_rpm" INTEGER,
    "temperatura_c" DECIMAL(4,1),
    "spo2_pct" INTEGER,
    "glucosa_mgdl" DECIMAL(6,2),
    "perimetro_cm" DECIMAL(5,2),
    "dolor_escala" INTEGER,
    "notas" TEXT,
    "capturada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sync_pending" BOOLEAN NOT NULL DEFAULT false,
    "creada_offline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signos_vitales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosticos" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT NOT NULL,
    "cie10_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "notas" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnosticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_laboratorio" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT,
    "paciente_id" TEXT NOT NULL,
    "medico_id" TEXT,
    "sede_id" TEXT NOT NULL,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'EMITIDA',
    "codigo_barra" TEXT NOT NULL,
    "instrucciones_paciente" TEXT,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_toma_muestra" TIMESTAMP(3),
    "fecha_procesamiento" TIMESTAMP(3),
    "fecha_resultado" TIMESTAMP(3),
    "tomado_por_id" TEXT,
    "procesado_por_id" TEXT,
    "liberado_por_id" TEXT,
    "notificado_medico" BOOLEAN NOT NULL DEFAULT false,
    "notificado_at" TIMESTAMP(3),
    "pdf_url" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_laboratorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_orden" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "estudio_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_lab" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "item_orden_id" TEXT,
    "estudio_nombre" TEXT NOT NULL,
    "valor" TEXT,
    "unidades" TEXT,
    "referencia_normal" TEXT,
    "fuera_rango" BOOLEAN NOT NULL DEFAULT false,
    "valor_critico" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "pdf_url" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT,
    "medico_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "tipo_receta" "TipoReceta" NOT NULL DEFAULT 'ORDINARIA',
    "folio_cofepris" TEXT,
    "numero_receta" TEXT NOT NULL,
    "estado" "EstadoReceta" NOT NULL DEFAULT 'ACTIVA',
    "qr_verificacion" TEXT,
    "pdf_url" TEXT,
    "compartida_wa_at" TIMESTAMP(3),
    "wa_message_id" TEXT,
    "sync_pending" BOOLEAN NOT NULL DEFAULT false,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_receta" (
    "id" TEXT NOT NULL,
    "receta_id" TEXT NOT NULL,
    "medicamento_id" TEXT,
    "medicamento_dci" TEXT NOT NULL,
    "medicamento_nombre_comercial" TEXT,
    "presentacion" TEXT,
    "dosis" TEXT NOT NULL,
    "via_administracion" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "duracion_dias" INTEGER,
    "cantidad_total" INTEGER,
    "indicaciones_paciente" TEXT,
    "es_controlado" BOOLEAN NOT NULL DEFAULT false,
    "alerta_contraindicacion" BOOLEAN NOT NULL DEFAULT false,
    "alerta_detalle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "consulta_id" TEXT,
    "sede_id" TEXT NOT NULL,
    "numero_factura_interno" TEXT NOT NULL,
    "cfdi_uuid" TEXT,
    "cfdi_xml_url" TEXT,
    "cfdi_pdf_url" TEXT,
    "estado_cfdi" "EstadoCFDI" NOT NULL DEFAULT 'BORRADOR',
    "estado_pago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "rfc_receptor" TEXT,
    "razon_social_receptor" TEXT,
    "regimen_fiscal_receptor" TEXT,
    "uso_cfdi" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "monto_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "saldo" DECIMAL(12,2) NOT NULL,
    "fecha_timbrado" TIMESTAMP(3),
    "qb_sync_pending" BOOLEAN NOT NULL DEFAULT true,
    "qb_invoice_id" TEXT,
    "qb_payment_id" TEXT,
    "qb_synced_at" TIMESTAMP(3),
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "factura_id" TEXT NOT NULL,
    "servicio_id" TEXT,
    "concepto" TEXT NOT NULL,
    "clave_sat" TEXT NOT NULL,
    "clave_unidad_sat" TEXT NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "cantidad" DECIMAL(8,3) NOT NULL DEFAULT 1,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "iva_aplicable" BOOLEAN NOT NULL DEFAULT false,
    "tasa_iva" DECIMAL(5,4) NOT NULL DEFAULT 0.00,
    "iva" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "factura_id" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "MetodoPagoSAT" NOT NULL,
    "referencia" TEXT,
    "conekta_charge_id" TEXT,
    "notas" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cortes_caja" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "total_efectivo" DECIMAL(12,2) NOT NULL,
    "total_tarjeta" DECIMAL(12,2) NOT NULL,
    "total_transf" DECIMAL(12,2) NOT NULL,
    "total_otros" DECIMAL(12,2) NOT NULL,
    "total_general" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cortes_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedientes_adiccion" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "medico_responsable_id" TEXT NOT NULL,
    "psicologo_id" TEXT,
    "trabajador_social_id" TEXT,
    "modalidad" "ModalidadTratamiento" NOT NULL,
    "sustancia_principal" TEXT NOT NULL,
    "sustancias_secundarias" TEXT[],
    "edad_inicio" INTEGER,
    "patron_consumo" TEXT,
    "motivo_consulta" TEXT NOT NULL,
    "historia_social" TEXT,
    "red_apoyo" TEXT,
    "antecedentes_psiquiatricos" TEXT,
    "historia_familiar" TEXT,
    "estado_tratamiento" "EstadoTratamiento" NOT NULL DEFAULT 'EN_EVALUACION',
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_egreso" TIMESTAMP(3),
    "motivo_egreso" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expedientes_adiccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_tratamiento" (
    "id" TEXT NOT NULL,
    "expediente_adiccion_id" TEXT NOT NULL,
    "elaborado_por_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "diagnostico_cie10" TEXT NOT NULL,
    "objetivo_general" TEXT NOT NULL,
    "objetivos_especificos" TEXT[],
    "modalidad" "ModalidadTratamiento" NOT NULL,
    "intervenciones" TEXT[],
    "sesiones_sem_medico" INTEGER NOT NULL DEFAULT 1,
    "sesiones_sem_psico" INTEGER NOT NULL DEFAULT 1,
    "sesiones_sem_grupal" INTEGER NOT NULL DEFAULT 0,
    "duracion_meses" INTEGER,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_revision" TIMESTAMP(3) NOT NULL,
    "fecha_cierre_estimada" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planes_tratamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrumentos_aplicados" (
    "id" TEXT NOT NULL,
    "expediente_adiccion_id" TEXT NOT NULL,
    "instrumento_id" TEXT NOT NULL,
    "aplicado_por_id" TEXT NOT NULL,
    "respuestas" JSONB NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "interpretacion" TEXT NOT NULL,
    "observaciones" TEXT,
    "aplicado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instrumentos_aplicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_sesion" (
    "id" TEXT NOT NULL,
    "expediente_adiccion_id" TEXT NOT NULL,
    "registrado_por_id" TEXT NOT NULL,
    "tipo_sesion" TEXT NOT NULL,
    "objetivos_sesion" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "logros" TEXT,
    "tareas" TEXT,
    "proxima_sesion" TEXT,
    "hubo_consumo" BOOLEAN,
    "sustancias_consumo" TEXT[],
    "firmada" BOOLEAN NOT NULL DEFAULT false,
    "firmada_at" TIMESTAMP(3),
    "sync_pending" BOOLEAN NOT NULL DEFAULT false,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_consumo" (
    "id" TEXT NOT NULL,
    "expediente_adiccion_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hubo_consumo" BOOLEAN NOT NULL,
    "sustancias" JSONB,
    "estado_animo" INTEGER,
    "nivel_ansiedad" INTEGER,
    "factores_riesgo" TEXT[],
    "notas" TEXT,
    "sync_pending" BOOLEAN NOT NULL DEFAULT false,
    "creado_offline" BOOLEAN NOT NULL DEFAULT false,
    "timestamp_local" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_consumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "stock" DECIMAL(10,3) NOT NULL,
    "stock_minimo" DECIMAL(10,3) NOT NULL,
    "precio" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_inventario" (
    "id" TEXT NOT NULL,
    "inventario_id" TEXT NOT NULL,
    "numero_lote" TEXT NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "fecha_caducidad" TIMESTAMP(3),
    "proveedor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "inventario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "stock_antes" DECIMAL(10,3) NOT NULL,
    "stock_despues" DECIMAL(10,3) NOT NULL,
    "motivo" TEXT,
    "referencia" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_portal" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "asunto" TEXT,
    "contenido" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "respondido_at" TIMESTAMP(3),
    "respuesta" TEXT,
    "respondido_por_id" TEXT,
    "sync_pending" BOOLEAN NOT NULL DEFAULT false,
    "creado_offline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_portal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT,
    "medico_id" TEXT,
    "canal" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pending',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimo_intento" TIMESTAMP(3),
    "error" TEXT,
    "proveedor_msg_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_at" TIMESTAMP(3),

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_rol" TEXT,
    "actor_email" TEXT,
    "sede_id" TEXT,
    "accion" TEXT NOT NULL,
    "recurso_tipo" TEXT NOT NULL,
    "recurso_id" TEXT,
    "datos_previos" JSONB,
    "datos_nuevos" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "es_offline_sync" BOOLEAN NOT NULL DEFAULT false,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especialidades_clave_key" ON "especialidades"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "medicamentos_clave_cofepris_key" ON "medicamentos"("clave_cofepris");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_cie10_codigo_key" ON "codigos_cie10"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estudios_lab_clave_key" ON "estudios_lab"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "instrumentos_nombre_key" ON "instrumentos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_catalogo_clave_key" ON "servicios_catalogo"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "medicos_usuario_id_key" ON "medicos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_numero_expediente_key" ON "pacientes"("numero_expediente");

-- CreateIndex
CREATE INDEX "pacientes_sede_id_idx" ON "pacientes"("sede_id");

-- CreateIndex
CREATE INDEX "pacientes_numero_expediente_idx" ON "pacientes"("numero_expediente");

-- CreateIndex
CREATE INDEX "citas_medico_id_fecha_inicio_idx" ON "citas"("medico_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "citas_sede_id_fecha_inicio_idx" ON "citas"("sede_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "citas_paciente_id_idx" ON "citas"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultas_cita_id_key" ON "consultas"("cita_id");

-- CreateIndex
CREATE INDEX "consultas_paciente_id_idx" ON "consultas"("paciente_id");

-- CreateIndex
CREATE INDEX "consultas_medico_id_idx" ON "consultas"("medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "signos_vitales_consulta_id_key" ON "signos_vitales"("consulta_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_laboratorio_codigo_barra_key" ON "ordenes_laboratorio"("codigo_barra");

-- CreateIndex
CREATE UNIQUE INDEX "recetas_numero_receta_key" ON "recetas"("numero_receta");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_consulta_id_key" ON "facturas"("consulta_id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_numero_factura_interno_key" ON "facturas"("numero_factura_interno");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_cfdi_uuid_key" ON "facturas"("cfdi_uuid");

-- CreateIndex
CREATE INDEX "facturas_sede_id_created_at_idx" ON "facturas"("sede_id", "created_at");

-- CreateIndex
CREATE INDEX "facturas_estado_cfdi_idx" ON "facturas"("estado_cfdi");

-- CreateIndex
CREATE INDEX "facturas_qb_sync_pending_idx" ON "facturas"("qb_sync_pending");

-- CreateIndex
CREATE UNIQUE INDEX "expedientes_adiccion_paciente_id_key" ON "expedientes_adiccion"("paciente_id");

-- CreateIndex
CREATE INDEX "notificaciones_estado_idx" ON "notificaciones"("estado");

-- CreateIndex
CREATE INDEX "notificaciones_paciente_id_idx" ON "notificaciones"("paciente_id");

-- CreateIndex
CREATE INDEX "auditoria_actor_id_idx" ON "auditoria"("actor_id");

-- CreateIndex
CREATE INDEX "auditoria_recurso_tipo_recurso_id_idx" ON "auditoria"("recurso_tipo", "recurso_id");

-- CreateIndex
CREATE INDEX "auditoria_sede_id_created_at_idx" ON "auditoria"("sede_id", "created_at");

-- AddForeignKey
ALTER TABLE "medico_sedes" ADD CONSTRAINT "medico_sedes_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medico_sedes" ADD CONSTRAINT "medico_sedes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_sede" ADD CONSTRAINT "horarios_sede_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicos" ADD CONSTRAINT "medicos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medico_especialidades" ADD CONSTRAINT "medico_especialidades_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medico_especialidades" ADD CONSTRAINT "medico_especialidades_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alergias" ADD CONSTRAINT "alergias_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antecedentes" ADD CONSTRAINT "antecedentes_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_clinicas" ADD CONSTRAINT "plantillas_clinicas_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_nota" ADD CONSTRAINT "versiones_nota_nota_id_fkey" FOREIGN KEY ("nota_id") REFERENCES "notas_clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signos_vitales" ADD CONSTRAINT "signos_vitales_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_cie10_id_fkey" FOREIGN KEY ("cie10_id") REFERENCES "codigos_cie10"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_laboratorio" ADD CONSTRAINT "ordenes_laboratorio_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_laboratorio" ADD CONSTRAINT "ordenes_laboratorio_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_laboratorio" ADD CONSTRAINT "ordenes_laboratorio_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_laboratorio" ADD CONSTRAINT "ordenes_laboratorio_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_orden" ADD CONSTRAINT "items_orden_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_laboratorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_orden" ADD CONSTRAINT "items_orden_estudio_id_fkey" FOREIGN KEY ("estudio_id") REFERENCES "estudios_lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_lab" ADD CONSTRAINT "resultados_lab_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_laboratorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_lab" ADD CONSTRAINT "resultados_lab_item_orden_id_fkey" FOREIGN KEY ("item_orden_id") REFERENCES "items_orden"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_receta" ADD CONSTRAINT "items_receta_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "recetas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_receta" ADD CONSTRAINT "items_receta_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes_adiccion" ADD CONSTRAINT "expedientes_adiccion_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes_adiccion" ADD CONSTRAINT "expedientes_adiccion_medico_responsable_id_fkey" FOREIGN KEY ("medico_responsable_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_tratamiento" ADD CONSTRAINT "planes_tratamiento_expediente_adiccion_id_fkey" FOREIGN KEY ("expediente_adiccion_id") REFERENCES "expedientes_adiccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrumentos_aplicados" ADD CONSTRAINT "instrumentos_aplicados_expediente_adiccion_id_fkey" FOREIGN KEY ("expediente_adiccion_id") REFERENCES "expedientes_adiccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrumentos_aplicados" ADD CONSTRAINT "instrumentos_aplicados_instrumento_id_fkey" FOREIGN KEY ("instrumento_id") REFERENCES "instrumentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_sesion" ADD CONSTRAINT "notas_sesion_expediente_adiccion_id_fkey" FOREIGN KEY ("expediente_adiccion_id") REFERENCES "expedientes_adiccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_consumo" ADD CONSTRAINT "diario_consumo_expediente_adiccion_id_fkey" FOREIGN KEY ("expediente_adiccion_id") REFERENCES "expedientes_adiccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "lotes_inventario_inventario_id_fkey" FOREIGN KEY ("inventario_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_inventario_id_fkey" FOREIGN KEY ("inventario_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_portal" ADD CONSTRAINT "mensajes_portal_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
