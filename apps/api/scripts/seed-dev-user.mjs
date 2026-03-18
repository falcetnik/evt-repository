import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEV_USER_ID = 'local-organizer-dev-user';

async function run() {
  const user = await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: { displayName: 'Local Organizer' },
    create: {
      id: DEV_USER_ID,
      displayName: 'Local Organizer',
    },
  });

  console.log(`DEV_USER_ID=${user.id}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
