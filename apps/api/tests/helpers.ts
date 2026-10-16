import type { SystemStatusPayload } from '@sentinel/shared';
import { pino } from 'pino';
import type { Env } from '../src/config/env.js';
import type { NormalizedIncident } from '../src/providers/types.js';
import { buildApp, type AppDependencies } from '../src/app.js';
import { MemoryIncidentRepository } from '../src/repositories/memory-repository.js';
import { RealtimeHub } from '../src/websocket/hub.js';

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgresql://sentinel:sentinel@localhost:5432/sentinel',
    CORS_ORIGIN: 'http://localhost:5173',
    DEMO_MODE: true,
    POLLING_INTERVAL_MS: 15_000,
    PROVIDER_TIMEOUT_MS: 1_000,
    PROVIDER_MAX_RETRIES: 1,
    USGS_API_URL: 'https://example.com/usgs.json',
    WILDFIRE_API_URL: 'https://example.com/eonet.json',
    LOG_LEVEL: 'error',
    ...overrides,
  };
}

export function makeNormalized(overrides: Partial<NormalizedIncident> = {}): NormalizedIncident {
  return {
    externalId: 'ext-1',
    source: 'usgs',
    type: 'EARTHQUAKE',
    title: 'M 4.5 - 10 km W of Berkeley, CA',
    description: 'Test earthquake near Berkeley.',
    latitude: 37.87,
    longitude: -122.35,
    severity: 'HIGH',
    magnitude: 4.5,
    confidence: null,
    status: 'ACTIVE',
    occurredAt: new Date('2026-10-05T12:00:00.000Z'),
    sourceUrl: 'https://example.com/events/ext-1',
    metadata: { place: '10 km W of Berkeley, CA' },
    ...overrides,
  };
}

export function systemStatus(overrides: Partial<SystemStatusPayload> = {}): SystemStatusPayload {
  return {
    demoMode: true,
    api: 'operational',
    database: 'connected',
    lastSyncAt: null,
    connectedClients: 0,
    providers: [],
    ...overrides,
  };
}

export async function createTestApp(options?: {
  repository?: MemoryIncidentRepository;
  checkDatabase?: () => Promise<boolean>;
  status?: SystemStatusPayload;
}) {
  const repository = options?.repository ?? new MemoryIncidentRepository();
  const hub = new RealtimeHub();
  const deps: AppDependencies = {
    env: testEnv(),
    logger: pino({ level: 'silent' }),
    repository,
    hub,
    checkDatabase: options?.checkDatabase ?? (async () => true),
    getSystemStatus: () => options?.status ?? systemStatus(),
    startedAt: Date.now(),
  };
  const app = await buildApp(deps);
  return { app, repository, hub };
}
