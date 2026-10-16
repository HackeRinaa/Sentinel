import type { ProviderStatus, SystemStatusPayload } from '@sentinel/shared';
import type { IncidentProvider } from '../providers/types.js';
import type { RealtimeHub } from '../websocket/hub.js';

export class ProviderStatusRegistry {
  private readonly statuses = new Map<string, ProviderStatus>();

  constructor(providers: Array<Pick<IncidentProvider, 'name' | 'displayName'>>) {
    for (const provider of providers) {
      this.statuses.set(provider.name, {
        name: provider.name,
        displayName: provider.displayName,
        status: 'idle',
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        lastReceivedCount: 0,
        lastCreatedCount: 0,
        lastUpdatedCount: 0,
        lastRemovedCount: 0,
      });
    }
  }

  markSuccess(
    name: string,
    counts: { received: number; created: number; updated: number; removed: number },
    at: Date,
  ): void {
    const current = this.require(name);
    this.statuses.set(name, {
      ...current,
      status: 'operational',
      lastSuccessAt: at.toISOString(),
      lastAttemptAt: at.toISOString(),
      lastError: null,
      lastReceivedCount: counts.received,
      lastCreatedCount: counts.created,
      lastUpdatedCount: counts.updated,
      lastRemovedCount: counts.removed,
    });
  }

  markFailure(name: string, message: string, at: Date): void {
    const current = this.require(name);
    this.statuses.set(name, {
      ...current,
      status: 'down',
      lastAttemptAt: at.toISOString(),
      lastError: message.slice(0, 300),
    });
  }

  snapshot(): ProviderStatus[] {
    return [...this.statuses.values()];
  }

  private require(name: string): ProviderStatus {
    const current = this.statuses.get(name);
    if (!current) {
      throw new Error(`Unknown provider ${name}`);
    }
    return current;
  }
}

export class SystemMonitor {
  database: SystemStatusPayload['database'] = 'disconnected';

  constructor(
    private readonly registry: ProviderStatusRegistry,
    private readonly hub: RealtimeHub,
    private readonly demoMode: boolean,
  ) {}

  snapshot(): SystemStatusPayload {
    const providers = this.registry.snapshot();
    const lastSyncAt =
      providers
        .map((provider) => provider.lastSuccessAt)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ?? null;
    return {
      demoMode: this.demoMode,
      api: 'operational',
      database: this.database,
      lastSyncAt,
      connectedClients: this.hub.size,
      providers,
    };
  }
}
