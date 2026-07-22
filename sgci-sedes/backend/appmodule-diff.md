# Registrar SedesModule en AppModule

## Archivo: apps/api/src/app.module.ts

### PASO 1 — Agregar import
```typescript
import { SedesModule } from './sedes/sedes.module';
```

### PASO 2 — Agregar al array imports
```typescript
@Module({
  imports: [
    // ... módulos existentes ...
    SedesModule,   // ← Añadir aquí
  ],
})
export class AppModule {}
```
