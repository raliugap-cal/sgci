// Script de diagnóstico — correr con: npx ts-node src/database/check.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 SGCI — Diagnóstico de base de datos\n');

  // 1. Conexión
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexión a PostgreSQL: OK');
  } catch (e: any) {
    console.log('❌ Sin conexión a PostgreSQL:', e.message);
    return;
  }

  // 2. Tablas existentes
  const tables = await prisma.$queryRaw<{tablename:string}[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const tableNames = tables.map(t => t.tablename);
  console.log(`\n📋 Tablas encontradas (${tableNames.length}):`);
  const needed = ['usuarios','sedes','citas','consultas','pacientes','facturas','refresh_tokens','auditorias'];
  for (const t of needed) {
    const exists = tableNames.includes(t);
    console.log(`  ${exists ? '✅' : '❌'} ${t}`);
  }

  // 3. Usuario superadmin
  console.log('\n👤 Usuario superadmin:');
  try {
    const user = await prisma.usuario.findUnique({
      where: { email: 'superadmin@clinicasgci.mx' }
    });
    if (!user) {
      console.log('  ❌ NO EXISTE — necesitas correr el seed');
    } else {
      console.log('  ✅ Existe');
      console.log(`  Activo: ${user.activo ? '✅' : '❌'}`);
      console.log(`  Roles: ${user.roles}`);
      console.log(`  Intentos fallidos: ${user.intentosFallidos}`);
      console.log(`  Bloqueado hasta: ${user.bloqueadoHasta ?? 'No bloqueado'}`);
      
      // Verificar contraseña
      const ok = await bcrypt.compare('Admin@SGCI2024!', user.passwordHash);
      console.log(`  Contraseña "Admin@SGCI2024!": ${ok ? '✅ Correcta' : '❌ Incorrecta'}`);
    }
  } catch (e: any) {
    console.log('  ❌ Error al consultar:', e.message);
  }

  // 4. Sede
  console.log('\n🏥 Sede principal:');
  try {
    const sede = await prisma.sede.findFirst();
    if (!sede) {
      console.log('  ❌ NO EXISTE — necesitas correr el seed');
    } else {
      console.log(`  ✅ ${sede.nombre} (ID: ${sede.id})`);
    }
  } catch (e: any) {
    console.log('  ❌ Error:', e.message);
  }

  console.log('\n✅ Diagnóstico completo\n');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
