import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const userId = process.env.DEV_ORGANIZER_USER_ID ?? 'dev-organizer-user';
  const email = process.env.DEV_ORGANIZER_EMAIL ?? 'organizer@example.com';

  await prisma.user.upsert({
    where: { id: userId },
    update: { displayName: 'Dev Organizer' },
    create: {
      id: userId,
      displayName: 'Dev Organizer',
      authIdentities: {
        create: {
          provider: 'EMAIL',
          providerSubject: email,
          providerEmail: email,
        },
      },
    },
  });

  await prisma.$disconnect();
  // eslint-disable-next-line no-console
  console.log(`Seeded dev organizer user: ${userId}`);
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
