import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const userId = 'dev-user-1';

  await prisma.user.upsert({
    where: { id: userId },
    update: { displayName: 'Dev Organizer' },
    create: { id: userId, displayName: 'Dev Organizer' },
  });

  await prisma.$disconnect();
  // eslint-disable-next-line no-console
  console.log(`Seeded development user id: ${userId}`);
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
