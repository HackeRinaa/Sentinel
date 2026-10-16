import type { Incident } from '@sentinel/shared';
import type { NormalizedIncident } from '../providers/types.js';
import {
  dedupeIncidents,
  describeChanges,
  hasMaterialChange,
  resolvedRevision,
  type RevisionDraft,
} from './change-detection.js';
import type { SyncResult } from './types.js';

export interface IncidentStore {
  listBySource(source: string): Promise<Incident[]>;
  insert(incident: NormalizedIncident, now: Date): Promise<Incident>;
  update(id: string, incident: NormalizedIncident, now: Date): Promise<Incident>;
  touch(id: string, now: Date): Promise<void>;
  markResolved(id: string, now: Date): Promise<Incident>;
  recordRevisions(incidentId: string, drafts: RevisionDraft[], now: Date): Promise<void>;
}

export async function applySnapshot(
  store: IncidentStore,
  source: string,
  incoming: NormalizedIncident[],
  options: { allowRemovals: boolean; now?: Date },
): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const incidents = dedupeIncidents(incoming);
  const existing = await store.listBySource(source);
  const existingByExternalId = new Map(existing.map((incident) => [incident.externalId, incident]));
  const seen = new Set<string>();
  const created: Incident[] = [];
  const updated: Incident[] = [];

  for (const incident of incidents) {
    seen.add(incident.externalId);
    const current = existingByExternalId.get(incident.externalId);
    if (!current) {
      created.push(await store.insert(incident, now));
      continue;
    }
    if (hasMaterialChange(current, incident)) {
      const saved = await store.update(current.id, incident, now);
      await store.recordRevisions(saved.id, describeChanges(current, incident), now);
      updated.push(saved);
    } else {
      await store.touch(current.id, now);
    }
  }

  const removed: Incident[] = [];
  if (options.allowRemovals) {
    for (const current of existing) {
      if (current.status !== 'ACTIVE' || seen.has(current.externalId)) {
        continue;
      }
      const resolved = await store.markResolved(current.id, now);
      await store.recordRevisions(resolved.id, [resolvedRevision], now);
      removed.push(resolved);
    }
  }

  return { created, updated, removed, received: incidents.length };
}
