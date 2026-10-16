import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { RealtimeEvent } from '@sentinel/shared';
import type { IncidentProvider, ProviderFetchResult } from '../src/providers/types.js';
import { MemoryIncidentRepository } from '../src/repositories/memory-repository.js';
import { IngestionService } from '../src/services/ingestion-service.js';
import { ProviderStatusRegistry, SystemMonitor } from '../src/services/provider-status.js';
import { RealtimeHub } from '../src/websocket/hub.js';
import { makeNormalized } from './helpers.js';

class RecordingHub extends RealtimeHub {
  readonly events: RealtimeEvent[] = [];

  override broadcast(event: RealtimeEvent): void {
    this.events.push(event);
    super.broadcast(event);
  }
}

class SequenceProvider implements IncidentProvider {
  readonly name = 'fake';
  readonly displayName = 'Fake provider';
  private index = 0;

  constructor(private readonly steps: Array<ProviderFetchResult | Error>) {}

  async fetchIncidents(): Promise<ProviderFetchResult> {
    const step = this.steps[Math.min(this.index, this.steps.length - 1)];
    this.index += 1;
    if (!step || step instanceof Error) {
      throw step ?? new Error('missing step');
    }
    return step;
  }
}

function service(provider: IncidentProvider, repository = new MemoryIncidentRepository()) {
  const hub = new RecordingHub();
  const registry = new ProviderStatusRegistry([provider]);
  const monitor = new SystemMonitor(registry, hub, true);
  monitor.database = 'connected';
  const ingestion = new IngestionService(
    provider ? [provider] : [],
    repository,
    hub,
    registry,
    monitor,
    pino({ level: 'silent' }),
    {
      timeoutMs: 1_000,
      retries: 0,
    },
  );
  return { ingestion, hub, registry, repository };
}

describe('ingestion service', () => {
  it('persists the first sync quietly and broadcasts later changes', async () => {
    const provider = new SequenceProvider([
      { incidents: [makeNormalized({ source: 'fake' })], skipped: 0 },
      {
        incidents: [
          makeNormalized({ source: 'fake', magnitude: 5.6, title: 'M 5.6 - revised' }),
          makeNormalized({
            source: 'fake',
            externalId: 'ext-2',
            title: 'M 3.0 - new',
            magnitude: 3,
          }),
        ],
        skipped: 0,
      },
    ]);
    const { ingestion, hub } = service(provider);

    await ingestion.syncProvider(provider);
    expect(hub.events.map((event) => event.type)).toEqual(['SYSTEM_STATUS']);

    await ingestion.syncProvider(provider);
    const types = hub.events.map((event) => event.type);
    expect(types).toContain('INCIDENT_UPDATED');
    expect(types).toContain('INCIDENT_CREATED');
    expect(types.filter((type) => type === 'SYSTEM_STATUS')).toHaveLength(2);
  });

  it('records provider failure without throwing or deleting stored incidents', async () => {
    const provider = new SequenceProvider([
      { incidents: [makeNormalized({ source: 'fake' })], skipped: 0 },
      new Error('upstream unavailable'),
    ]);
    const { ingestion, hub, registry, repository } = service(provider);
    await ingestion.syncProvider(provider);
    await expect(ingestion.syncProvider(provider)).resolves.toBeUndefined();
    expect(registry.snapshot()[0]?.status).toBe('down');
    expect(registry.snapshot()[0]?.lastError).toMatch(/upstream unavailable/);
    expect(await repository.countActiveBySource('fake')).toBe(1);
    expect(hub.events.at(-1)?.type).toBe('SYSTEM_STATUS');
  });

  it('does not wipe incidents when a provider returns an empty payload', async () => {
    const provider = new SequenceProvider([
      { incidents: [makeNormalized({ source: 'fake' })], skipped: 0 },
      { incidents: [], skipped: 0 },
    ]);
    const { ingestion, repository } = service(provider);
    await ingestion.syncProvider(provider);
    await ingestion.syncProvider(provider);
    expect(await repository.countActiveBySource('fake')).toBe(1);
  });
});
