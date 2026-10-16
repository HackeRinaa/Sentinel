import type { SystemStatusPayload } from '@sentinel/shared';
import type { FastifyInstance } from 'fastify';

export function registerProviderRoutes(
  app: FastifyInstance,
  deps: { getSystemStatus: () => SystemStatusPayload },
): void {
  app.get('/api/providers/status', async () => ({
    data: deps.getSystemStatus(),
  }));
}
