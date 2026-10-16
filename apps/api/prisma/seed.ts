import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../src/config/env.js';
import { createInitialDemoState } from '../src/providers/demo-provider.js';
import { toCreateData } from '../src/repositories/prisma-repository.js';

const env = loadEnv();
if (!env.DEMO_MODE) {
  console.error('Refusing to seed simulated incidents while DEMO_MODE=false.');
  process.exit(1);
}

const prisma = new PrismaClient();
const now = new Date();
const state = createInitialDemoState(now);

try {
  for (const incident of state.active) {
    await prisma.incident.upsert({
      where: {
        source_externalId: { source: incident.source, externalId: incident.externalId },
      },
      create: toCreateData(incident, now),
      update: {},
    });
  }
  console.log(`Seeded ${state.active.length} simulated incidents.`);
} finally {
  await prisma.$disconnect();
}
