import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const user = await prisma.usuario.findUnique({
  where: { email: 'superadmin@clinicasgci.mx' },
  select: {
    email:            true,
    activo:           true,
    intentosFallidos: true,
    bloqueadoHasta:   true,
  },
});

console.log('=== USUARIO SUPERADMIN ===');
console.log(JSON.stringify(user, null, 2));

if (!user) {
  console.log('❌ USUARIO NO EXISTE — necesitas correr el seed');
} else {
  if (!user.activo)               console.log('❌ PROBLEMA: usuario inactivo');
  if (user.intentosFallidos > 0)  console.log('❌ PROBLEMA: intentos fallidos =', user.intentosFallidos);
  if (user.bloqueadoHasta)        console.log('❌ PROBLEMA: bloqueado hasta', user.bloqueadoHasta);
  if (user.activo && !user.bloqueadoHasta && user.intentosFallidos === 0)
                                  console.log('✅ Usuario OK — el problema es el password');
}

await prisma.$disconnect();