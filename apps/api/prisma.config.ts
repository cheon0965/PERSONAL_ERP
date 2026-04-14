import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'node ../../scripts/run-with-root-env.cjs tsx prisma/seed.ts'
  }
});
