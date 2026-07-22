# Cambio en AppShell — Agregar "Sedes" al menú

## Archivo: apps/web/src/components/AppShell.tsx

### PASO 1 — Agregar import del icono
En la línea de imports de lucide-react, añadir `Building2`:

```typescript
import {
  Calendar, Users, FileText, FlaskConical, Pill, Receipt,
  BarChart2, Settings, LogOut, ChevronDown, Bell, Search,
  Heart, ClipboardList, Menu, X, Shield, Stethoscope, Building2,
} from 'lucide-react';
```

### PASO 2 — Agregar ítem en NAV_ITEMS
En el array NAV_ITEMS, añadir ANTES del ítem de Admin:

```typescript
  { href: '/admin/sedes', icon: Building2, label: 'Sedes', roles: ['SUPERADMIN'] },
```

Resultado del array completo con el nuevo ítem:
```typescript
const NAV_ITEMS = [
  { href: '/dashboard',    icon: BarChart2,      label: 'Dashboard',   roles: [] },
  { href: '/agenda',       icon: Calendar,       label: 'Agenda',      roles: [] },
  { href: '/pacientes',    icon: Users,          label: 'Pacientes',   roles: [] },
  { href: '/consulta',     icon: Stethoscope,    label: 'Consultas',   roles: ['MEDICO','PSICOLOGO','SUPERADMIN','ADMIN_SEDE'] },
  { href: '/adicciones',   icon: Heart,          label: 'Adicciones',  roles: ['MEDICO','PSICOLOGO','TRABAJO_SOCIAL','SUPERADMIN','ADMIN_SEDE'] },
  { href: '/laboratorio',  icon: FlaskConical,   label: 'Laboratorio', roles: ['MEDICO','LABORATORIO','ENFERMERIA','SUPERADMIN','ADMIN_SEDE'] },
  { href: '/recetas',      icon: Pill,           label: 'Recetas',     roles: ['MEDICO','PSICOLOGO','SUPERADMIN'] },
  { href: '/facturacion',  icon: Receipt,        label: 'Facturación', roles: ['CAJA','ADMIN_SEDE','SUPERADMIN'] },
  { href: '/reportes',     icon: ClipboardList,  label: 'Reportes',    roles: ['ADMIN_SEDE','SUPERADMIN'] },
  { href: '/admin/sedes',  icon: Building2,      label: 'Sedes',       roles: ['SUPERADMIN'] },
  { href: '/admin',        icon: Settings,       label: 'Admin',       roles: ['ADMIN_SEDE','SUPERADMIN'] },
];
```

### PASO 3 — Crear directorio y archivo de página
Crear: apps/web/src/app/(app)/admin/sedes/page.tsx
Contenido: copiar sedes-page.tsx completo (es el archivo de este ZIP)
