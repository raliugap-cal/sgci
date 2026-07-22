# Schema Changes — Gestión de Sedes

## CAMBIO 1 — Añadir tabla MedicoSede (pivot)
Añadir DESPUÉS del model MedicoEspecialidad:

```prisma
model MedicoSede {
  medicoId    String   @map("medico_id")
  sedeId      String   @map("sede_id")
  activo      Boolean  @default(true)
  esSedeBase  Boolean  @default(false) @map("es_sede_base")
  asignadoAt  DateTime @default(now()) @map("asignado_at")

  medico      Medico   @relation(fields: [medicoId], references: [id])
  sede        Sede     @relation(fields: [sedeId], references: [id])

  @@id([medicoId, sedeId])
  @@map("medico_sedes")
}
```

## CAMBIO 2 — Añadir back-ref en model Medico
Dentro del model Medico, en el bloque de relaciones, añadir:

```prisma
  sedes                MedicoSede[]
```

## CAMBIO 3 — Añadir back-ref en model Sede
Dentro del model Sede, en el bloque de relaciones, añadir:

```prisma
  medicosSedes         MedicoSede[]
  recetas              Receta[]
  ordenes              OrdenLaboratorio[]
  notificaciones       Notificacion[]
  auditorias           Auditoria[]
```
NOTA: Solo agrega las que no existan aún. Verifica contra tu schema actual.

## CAMBIO 4 — SedeGuard (auth/strategies/jwt.strategy.ts)
Reemplazar la lógica del SedeGuard para soportar médicos multi-sede:

BUSCAR:
```typescript
const tieneAcceso =
  user.roles.includes(Rol.SUPERADMIN) ||
  user.sedeId === sedeId;
```

REEMPLAZAR CON:
```typescript
// SUPERADMIN accede a todo
if (user.roles.includes(Rol.SUPERADMIN)) return true;
// Sede principal del usuario
if (user.sedeId === sedeId) return true;
// Para médicos: verificar tabla medico_sedes en runtime
// (el guard ya dejó pasar — el service filtra por sedeId)
// Aquí solo bloqueamos si es un rol no-médico intentando cross-sede
const esMedico = user.roles.some(r =>
  [Rol.MEDICO, Rol.PSICOLOGO].includes(r)
);
if (esMedico && user.medicoId) return true; // el service valida acceso real
throw new UnauthorizedException('No tiene acceso a esta sede');
```

## Comando de migración
Después de editar schema.prisma, correr:
```bash
cd packages/database
npx prisma migrate dev --name add_medico_sedes
npx prisma generate
```
