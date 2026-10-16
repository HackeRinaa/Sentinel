import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { MemoryIncidentRepository } from '../src/repositories/memory-repository.js';
import { buildIncidentWhere } from '../src/repositories/where.js';
import { createTestApp, makeNormalized } from './helpers.js';

async function seededApp() {
  const repository = new MemoryIncidentRepository();
  await repository.applySnapshot(
    'usgs',
    [
      makeNormalized(),
      makeNormalized({
        externalId: 'fire-1',
        source: 'eonet',
        type: 'WILDFIRE',
        title: 'Park Fire - Northern California',
        description: 'Wildfire in northern California',
        severity: 'HIGH',
        magnitude: null,
        confidence: 0.86,
        latitude: 39.84,
        longitude: -122.21,
        metadata: { place: 'Northern California, USA' },
      }),
      makeNormalized({
        externalId: 'small-1',
        severity: 'LOW',
        magnitude: 1.4,
        title: 'M 1.4 - minor',
        latitude: 34.05,
        longitude: -118.25,
        occurredAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    ],
    { allowRemovals: true },
  );
  return createTestApp({ repository });
}

describe('environment configuration', () => {
  it('explains which variable is missing', () => {
    expect(() => loadEnv({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/);
  });

  it('coerces ports and demo mode', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://localhost/sentinel',
      DEMO_MODE: 'false',
      PORT: '4100',
    });
    expect(env.DEMO_MODE).toBe(false);
    expect(env.PORT).toBe(4100);
    expect(env.USGS_API_URL).toContain('earthquake.usgs.gov');
  });
});

describe('incident where builder', () => {
  it('combines type, severity floor, and search', () => {
    const where = buildIncidentWhere({
      types: ['EARTHQUAKE'],
      severities: [],
      sources: ['usgs'],
      startDate: null,
      endDate: null,
      minSeverity: 'HIGH',
      bbox: null,
      search: 'Berkeley',
      status: 'ACTIVE',
    });
    expect(where.type).toEqual({ in: ['EARTHQUAKE'] });
    expect(where.source).toEqual({ in: ['usgs'] });
    expect(where.status).toBe('ACTIVE');
    expect(where.severity).toEqual({ in: ['HIGH', 'CRITICAL'] });
    expect(where.OR).toHaveLength(2);
  });
});

describe('HTTP API', () => {
  it('reports health and a degraded database', async () => {
    const healthy = await createTestApp();
    const ok = await healthy.app.inject({ method: 'GET', url: '/api/health' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.database).toBe('connected');
    await healthy.app.close();

    const unhealthy = await createTestApp({ checkDatabase: async () => false });
    const down = await unhealthy.app.inject({ method: 'GET', url: '/api/health' });
    expect(down.statusCode).toBe(503);
    expect(down.json().data.status).toBe('degraded');
    await unhealthy.app.close();
  });

  it('filters, paginates, and sorts incidents', async () => {
    const { app } = await seededApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/incidents?type=EARTHQUAKE&minSeverity=MODERATE&page=1&pageSize=1&sortBy=magnitude&sortOrder=desc',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].type).toBe('EARTHQUAKE');
    expect(body.data[0].magnitude).toBe(4.5);
    expect(body.meta.total).toBe(1);
    expect(body.meta.totalPages).toBe(1);

    const search = await app.inject({ method: 'GET', url: '/api/incidents?search=Park%20Fire' });
    expect(search.json().data).toHaveLength(1);
    expect(search.json().data[0].type).toBe('WILDFIRE');
    await app.close();
  });

  it('returns stats, nearby incidents, detail, and validation errors', async () => {
    const { app, repository } = await seededApp();
    const stats = await app.inject({ method: 'GET', url: '/api/incidents/stats' });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().data.active).toBe(3);
    const wildfire = stats
      .json()
      .data.byType.find((entry: { type: string; count: number }) => entry.type === 'WILDFIRE');
    expect(wildfire?.count).toBe(1);

    const nearby = await app.inject({
      method: 'GET',
      url: '/api/incidents/nearby?lat=37.8&lng=-122.3&radiusKm=50',
    });
    expect(nearby.statusCode).toBe(200);
    expect(nearby.json().data).toHaveLength(1);
    expect(nearby.json().data[0].distanceKm).toBeLessThan(50);

    const listed = await repository.list({
      types: [],
      severities: [],
      sources: [],
      startDate: null,
      endDate: null,
      minSeverity: null,
      bbox: null,
      search: null,
      page: 1,
      pageSize: 10,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      status: 'ACTIVE',
    });
    const id = listed.items[0]?.id;
    const detail = await app.inject({ method: 'GET', url: `/api/incidents/${id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.id).toBe(id);

    const missing = await app.inject({ method: 'GET', url: '/api/incidents/does-not-exist' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');

    const invalid = await app.inject({ method: 'GET', url: '/api/incidents?page=0&minLat=1' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('VALIDATION_ERROR');
    expect(invalid.json().error.requestId).toBeTruthy();
    await app.close();
  });

  it('returns provider status', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/providers/status' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.demoMode).toBe(true);
    await app.close();
  });
});
