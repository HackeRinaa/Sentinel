import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  deps: { env: Env; checkDatabase: () => Promise<boolean>; startedAt: number },
): void {
  app.get('/api/health', async (_request, reply) => {
    const databaseUp = await deps.checkDatabase();
    const body = {
      data: {
        status: databaseUp ? 'ok' : 'degraded',
        api: 'operational',
        database: databaseUp ? 'connected' : 'disconnected',
        demoMode: deps.env.DEMO_MODE,
        uptimeSeconds: Math.round((Date.now() - deps.startedAt) / 1000),
        timestamp: new Date().toISOString(),
      },
    };
    return reply.status(databaseUp ? 200 : 503).send(body);
  });
}
