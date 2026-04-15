# 🚀 SGCI — Checklist de Go-Live (11 semanas)

## Semana 11 · Antes de poner en producción

### ✅ Infraestructura

- [ ] Servidor dedicado o VPS con min. 4 vCPU, 8 GB RAM, 100 GB SSD
- [ ] PostgreSQL 16 con backups automáticos configurados (diarios + WAL)
- [ ] Redis con persistencia AOF habilitada
- [ ] MinIO con bucket `sgci-clinica` y política de retención 10 años
- [ ] Certificado SSL/TLS wildcard para el dominio
- [ ] Firewall: solo puertos 80, 443, 22 (SSH) expuestos
- [ ] Acceso SSH mediante llaves (no contraseña)

### ✅ Variables de entorno de producción

- [ ] `JWT_SECRET` — 64 caracteres aleatorios (no reutilizar de dev)
- [ ] `JWT_REFRESH_SECRET` — 64 caracteres aleatorios distintos
- [ ] `ENCRYPTION_KEY` — 32 bytes aleatorios (⚠️ cambiar = perder todos los datos cifrados)
- [ ] `POSTGRES_PASSWORD` — contraseña fuerte, diferente a dev
- [ ] `DATABASE_URL` — apunta a servidor de producción
- [ ] `SENDGRID_API_KEY` — cuenta verificada con dominio del remitente
- [ ] `DAILY_API_KEY` — plan Pro o superior
- [ ] `PAC_URL/USER/PASS` — credenciales PAC productivas (no sandbox)
- [ ] `RENAPO_URL` — URL de producción con convenio vigente

### ✅ Normativas y compliance

- [ ] Aviso de privacidad impreso disponible en recepción (LFPDPPP)
- [ ] Responsable de protección de datos designado
- [ ] Proceso de respuesta a derechos ARCO documentado (< 20 días)
- [ ] Licencia sanitaria vigente configurada en el sistema
- [ ] Folios COFEPRIS cargados para médicos habilitados (mínimo 20 por médico)
- [ ] CSD (Certificado de Sello Digital SAT) cargado en el sistema
- [ ] Contraseña del CSD guardada en bóveda segura (NO en código)
- [ ] PAC en producción: al menos 1 timbrado de prueba exitoso
- [ ] RFC de la clínica verificado en el sistema SAT

### ✅ Pruebas de carga

```bash
# Ejecutar antes del go-live:
k6 run --env BASE_URL=https://api.clinica.mx/api/v1 scripts/load-test.js

# Resultados aceptables:
# p95 de respuesta < 500ms
# Tasa de error < 1%
# Sin memory leaks en 5 minutos de carga sostenida
```

- [ ] Load test completado con resultados aceptables
- [ ] Prueba de failover (reiniciar API sin pérdida de sesiones Redis)
- [ ] Prueba de backup/restore de base de datos

### ✅ UAT (User Acceptance Testing) — 3 sedes

**Sede 1 — Recepción:**
- [ ] Login y MFA funcionando
- [ ] Búsqueda de pacientes
- [ ] Agendar cita → confirmación por email al paciente
- [ ] Check-in de paciente en espera
- [ ] Crear pre-factura y registrar pago en efectivo
- [ ] Corte de caja al final del turno

**Sede 2 — Médico:**
- [ ] Abrir consulta desde cita
- [ ] Registrar signos vitales
- [ ] Crear nota SOAP y firmarla
- [ ] Buscar CIE-10 y agregar diagnóstico
- [ ] Emitir receta ordinaria con PDF
- [ ] Solicitar orden de laboratorio

**Sede 3 — Adicciones:**
- [ ] Abrir expediente NOM-028
- [ ] Aplicar instrumento AUDIT y ver puntaje
- [ ] Registrar sesión con notas
- [ ] Verificar que diario offline del paciente llega al expediente
- [ ] Generar reporte CONADIC preliminar

**Portal del paciente:**
- [ ] Login desde móvil (iOS Safari + Android Chrome)
- [ ] Instalar PWA en pantalla de inicio
- [ ] Ver citas en modo offline (sin WiFi)
- [ ] Registrar diario de consumo sin conexión
- [ ] Verificar que el diario aparece en el expediente del médico al reconectar
- [ ] Acceder a videoconsulta desde el portal
- [ ] Ver recetas y resultados de laboratorio

### ✅ Capacitación del personal

- [ ] Recepción: agenda, registro de pacientes, facturación básica (2h)
- [ ] Médicos: HCE, recetas, laboratorio, telemedicina (3h)
- [ ] Psicólogos/Trabajo Social: adicciones NOM-028, PTI, sesiones (2h)
- [ ] Laboratorio: órdenes, captura de resultados, liberación (1h)
- [ ] Administración: reportes, CONADIC, exportación contable, folios COFEPRIS (2h)

### ✅ Día 0 — Go-live

```bash
# 1. Deploy final
git tag v1.0.0
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d

# 2. Migraciones
docker exec sgci-api npx prisma migrate deploy

# 3. Seed de datos de producción
docker exec sgci-api npx ts-node src/database/seed.ts

# 4. Verificar health
curl https://api.clinica.mx/api/v1/health

# 5. Primer timbrado de prueba (CFDI)
# Crear factura demo y timbrar para verificar PAC y CSD

# 6. Activar monitoreo
docker compose -f docker/docker-compose.yml --profile monitoring up -d
```

- [ ] Health check verde en las 3 sedes
- [ ] Primer CFDI de producción timbrado exitosamente
- [ ] Acceso Swagger desactivado (NODE_ENV=production)
- [ ] Logs centralizados configurados
- [ ] Alertas de Grafana configuradas (CPU >80%, disk >70%, errores API)
- [ ] Número de soporte técnico comunicado a los 3 coordinadores de sede

---

## Post-lanzamiento — Semanas 12-14

### Activaciones pendientes (standby)

| Servicio | Activación | Esfuerzo |
|---|---|---|
| WhatsApp Business API | Cuando Meta apruebe WABA | 1 día: `WHATSAPP_ENABLED=true` + test plantillas |
| QuickBooks Online | Cuando la clínica lo decida | 1-2 días: OAuth2 + sync histórico |
| Push notifications (portal) | Semana 12 | 2 días: VAPID keys + endpoint suscripción |

### KPIs de seguimiento (mes 1)

- Tiempo promedio de registro de paciente: < 3 minutos
- Citas con nota SOAP firmada: > 95%
- Facturas timbradas mismo día: > 98%
- Entradas de diario offline sincronizadas exitosamente: > 99%
- Tiempo de respuesta API p95: < 400ms
