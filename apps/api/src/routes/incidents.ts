import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors/app-error.js';
import type { IncidentRepository } from '../repositories/types.js';
import {
  incidentIdSchema,
  incidentListQuerySchema,
  incidentStatsQuerySchema,
  nearbyQuerySchema,
} from '../schemas/incidents.js';
import { parseWithSchema } from '../schemas/http.js';

export function registerIncidentRoutes(app: FastifyInstance, repository: IncidentRepository): void {
  app.get('/api/incidents', async (request) => {
    const query = parseWithSchema(incidentListQuerySchema, request.query);
    const result = await repository.list(query);
    return { data: result.items, meta: result.meta };
  });

  app.get('/api/incidents/stats', async (request) => {
    const query = parseWithSchema(incidentStatsQuerySchema, request.query);
    return { data: await repository.stats(query) };
  });

  app.get('/api/incidents/nearby', async (request) => {
    const query = parseWithSchema(nearbyQuerySchema, request.query);
    return { data: await repository.nearby(query) };
  });

  app.get('/api/incidents/:id', async (request) => {
    const params = parseWithSchema(incidentIdSchema, request.params);
    const incident = await repository.findById(params.id);
    if (!incident) {
      throw new AppError(404, 'NOT_FOUND', 'Incident not found');
    }
    return { data: incident };
  });
}
