import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { createLogger } from './config/logger.js';
import { loadEnv } from './config/env.js';
import { ConfigError } from './errors/app-error.js';
import { createProviders } from './providers/index.js';
import { PrismaIncidentRepository } from './repositories/prisma-repository.js';
import { IngestionService } from './services/ingestion-service.js';
import { ProviderStatusRegistry, SystemMonitor } from './services/provider-status.js';
import { RealtimeHub } from './websocket/hub.js';

async function start(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = new PrismaClient();
  const repository = new PrismaIncidentRepository(prisma);
  const hub = new RealtimeHub();
  const providers = createProviders(env);
  const registry = new ProviderStatusRegistry(providers);
  const monitor = new SystemMonitor(registry, hub, env.DEMO_MODE);

  const checkDatabase = async (): Promise<boolean> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      monitor.database = 'connected';
      return true;
    } catch (error) {
      monitor.database = 'disconnected';
      logger.error({ err: error }, 'database health check failed');
      return false;
    }
  };

  const databaseReady = await checkDatabase();
  if (!databaseReady) {
    logger.error('database is not reachable');
    await prisma.$disconnect();
    process.exit(1);
  }

  const app = await buildApp({
    env,
    logger,
    repository,
    hub,
    checkDatabase,
    getSystemStatus: () => monitor.snapshot(),
  });

  const ingestion = new IngestionService(providers, repository, hub, registry, monitor, logger, {
    timeoutMs: env.PROVIDER_TIMEOUT_MS,
    retries: env.PROVIDER_MAX_RETRIES,
  });

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(
    {
      port: env.PORT,
      demoMode: env.DEMO_MODE,
      providers: providers.map((provider) => provider.name),
    },
    'sentinel api listening',
  );

  void ingestion.syncAll();
  const timer = setInterval(() => {
    void ingestion.syncAll();
  }, env.POLLING_INTERVAL_MS);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) {
      return;
    }
    closing = true;
    logger.info({ signal }, 'shutting down');
    clearInterval(timer);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

start().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
