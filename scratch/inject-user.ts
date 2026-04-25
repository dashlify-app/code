import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'test@dashlify.app';
  const password = 'MasterDash2025!';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('Inyectando usuario...');
  
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hashedPassword },
      create: {
        email,
        password: hashedPassword,
        organization: {
          create: { name: 'Dashlify Master Org' }
        }
      }
    });
    console.log('✅ Usuario inyectado con éxito:', user.email);
    console.log('🔑 Credenciales:');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (e) {
    console.error('❌ Error al inyectar:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
