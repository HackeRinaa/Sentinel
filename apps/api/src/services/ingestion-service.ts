import type { Incident } from '@sentinel/shared';
import type { AppLogger } from '../config/logger.js';
import type { IncidentProvider } from '../providers/types.js';
import { withRetry, withTimeout } from '../providers/retry.js';
import type { IncidentRepository } from '../repositories/types.js';
import { errorMessage } from '../utils/text.js';
import type { RealtimeHub } from '../websocket/hub.js';
import type { ProviderStatusRegistry, SystemMonitor } from './provider-status.js';

export class IngestionService {
  private readonly initialSync = new Set<string>();
  private running = false;

  constructor(
    private readonly providers: IncidentProvider[],
    private readonly repository: IncidentRepository,
    private readonly hub: RealtimeHub,
    private readonly registry: ProviderStatusRegistry,
    private readonly monitor: SystemMonitor,
    private readonly logger: AppLogger,
    private readonly options: { timeoutMs: number; retries: number },
  ) {}

  async syncAll(): Promise<void> {
    if (this.running) {
      this.logger.warn('skipping synchronization because the previous run is still active');
      return;
    }
    this.running = true;
    try {
      for (const provider of this.providers) {
        await this.syncProvider(provider);
      }
    } finally {
      this.running = false;
    }
  }

  async syncProvider(provider: IncidentProvider): Promise<void> {
    const started = Date.now();
    this.logger.info({ provider: provider.name }, 'provider synchronization started');
    try {
      const activeBefore = await this.repository.countActiveBySource(provider.name);
      const result = await withRetry(
        () => withTimeout(provider.fetchIncidents(), this.options.timeoutMs, provider.name),
        { retries: this.options.retries, baseDelayMs: 400, maxDelayMs: 8_000 },
      );
      const allowRemovals = !(result.incidents.length === 0 && activeBefore > 0);
      if (!allowRemovals) {
        this.logger.warn(
          { provider: provider.name },
          'provider returned zero incidents; skipping removals',
        );
      }
      const applied = await this.repository.applySnapshot(provider.name, result.incidents, {
        allowRemovals,
      });
      const at = new Date();
      this.registry.markSuccess(
        provider.name,
        {
          received: applied.received,
          created: applied.created.length,
          updated: applied.updated.length,
          removed: applied.removed.length,
        },
        at,
      );
      const isInitial = !this.initialSync.has(provider.name);
      this.initialSync.add(provider.name);
      if (!isInitial) {
        this.emitIncidents('INCIDENT_CREATED', applied.created);
        this.emitIncidents('INCIDENT_UPDATED', applied.updated);
        this.emitIncidents('INCIDENT_REMOVED', applied.removed);
      }
      this.broadcastStatus();
      this.logger.info(
        {
          provider: provider.name,
          received: applied.received,
          skipped: result.skipped,
          created: applied.created.length,
          updated: applied.updated.length,
          removed: applied.removed.length,
          durationMs: Date.now() - started,
        },
        'provider synchronization completed',
      );
    } catch (error) {
      this.registry.markFailure(provider.name, errorMessage(error), new Date());
      this.broadcastStatus();
      this.logger.error(
        { provider: provider.name, err: error, durationMs: Date.now() - started },
        'provider synchronization failed',
      );
    }
  }

  private emitIncidents(
    type: 'INCIDENT_CREATED' | 'INCIDENT_UPDATED' | 'INCIDENT_REMOVED',
    incidents: Incident[],
  ): void {
    for (const incident of incidents) {
      this.hub.broadcast({
        type,
        timestamp: new Date().toISOString(),
        payload: { incident },
      });
    }
  }

  private broadcastStatus(): void {
    this.hub.broadcast({
      type: 'SYSTEM_STATUS',
      timestamp: new Date().toISOString(),
      payload: this.monitor.snapshot(),
    });
  }
}
