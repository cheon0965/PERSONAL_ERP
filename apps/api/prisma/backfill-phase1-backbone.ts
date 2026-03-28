import { PrismaClient } from '@prisma/client';
import { backfillPhase1Backbone, formatPhase1BackboneSummary } from './phase1-backbone';

const prisma = new PrismaClient();

async function main() {
  const emailFlagIndex = process.argv.findIndex((arg) => arg === '--email');
  const email =
    emailFlagIndex >= 0 && process.argv[emailFlagIndex + 1]
      ? process.argv[emailFlagIndex + 1]
      : undefined;

  const summary = await backfillPhase1Backbone(prisma, email ? { email } : undefined);
  console.log(formatPhase1BackboneSummary(summary));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
