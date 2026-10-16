import {
  boundingBoxForRadius,
  haversineKm,
  matchesIncident,
  SEVERITY_RANK,
  type Incident,
  type IncidentDetail,
  type IncidentMatchFilters,
  type IncidentRevision,
  type NearbyIncident,
} from '@sentinel/shared';
import type { NormalizedIncident } from '../providers/types.js';
import { toDomainIncident, type RevisionDraft } from './change-detection.js';
import { summarizeIncidents, type SummaryRow } from './summary.js';
import { applySnapshot, type IncidentStore } from './sync.js';
import type {
  IncidentListQuery,
  IncidentRepository,
  IncidentStatsQuery,
  NearbyQuery,
  PaginatedIncidents,
  SyncResult,
} from './types.js';

const MAX_REVISIONS = 12;

export class MemoryIncidentRepository implements IncidentRepository {
  private incidents: Incident[] = [];
  private revisions = new Map<string, IncidentRevision[]>();

  async applySnapshot(
    source: string,
    incidents: NormalizedIncident[],
    options: { allowRemovals: boolean },
  ): Promise<SyncResult> {
    return applySnapshot(this.createStore(), source, incidents, options);
  }

  async list(query: IncidentListQuery): Promise<PaginatedIncidents> {
    const filtered = this.incidents.filter((incident) =>
      matchesIncident(incident, toMatchFilters(query)),
    );
    const sorted = [...filtered].sort((left, right) => compareIncidents(left, right, query));
    const total = sorted.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      items: sorted.slice(start, start + query.pageSize),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<IncidentDetail | null> {
    const incident = this.incidents.find((item) => item.id === id);
    if (!incident) {
      return null;
    }
    return { ...incident, revisions: this.revisions.get(id) ?? [] };
  }

  async stats(query: IncidentStatsQuery): Promise<ReturnType<typeof summarizeIncidents>> {
    const rows = this.incidents
      .filter((incident) =>
        matchesIncident(incident, { ...toMatchFiltersFromStats(query), status: 'ANY' }),
      )
      .map(toSummaryRow);
    return summarizeIncidents(rows, query, new Date());
  }

  async nearby(query: NearbyQuery): Promise<NearbyIncident[]> {
    const bbox = boundingBoxForRadius(query.latitude, query.longitude, query.radiusKm);
    return this.incidents
      .filter((incident) => incident.status === 'ACTIVE')
      .filter(
        (incident) =>
          incident.latitude >= bbox.minLat &&
          incident.latitude <= bbox.maxLat &&
          incident.longitude >= bbox.minLng &&
          incident.longitude <= bbox.maxLng,
      )
      .map((incident) => {
        const distanceKm = haversineKm(
          { latitude: query.latitude, longitude: query.longitude },
          { latitude: incident.latitude, longitude: incident.longitude },
        );
        return { incident, distanceKm };
      })
      .filter((entry) => entry.distanceKm <= query.radiusKm)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, query.limit)
      .map((entry) => ({ ...entry.incident, distanceKm: Math.round(entry.distanceKm * 10) / 10 }));
  }

  async countActiveBySource(source: string): Promise<number> {
    return this.incidents.filter(
      (incident) => incident.source === source && incident.status === 'ACTIVE',
    ).length;
  }

  private createStore(): IncidentStore {
    return {
      listBySource: async (source) =>
        this.incidents.filter((incident) => incident.source === source),
      insert: async (incident, now) => {
        const created = toDomainIncident(crypto.randomUUID(), incident, {
          createdAt: now,
          updatedAt: now,
          resolvedAt: incident.status === 'RESOLVED' ? now : null,
        });
        this.incidents.push(created);
        return created;
      },
      update: async (id, incident, now) => {
        const index = this.incidents.findIndex((item) => item.id === id);
        const existing = this.incidents[index];
        if (!existing) {
          throw new Error(`Incident ${id} not found`);
        }
        const updated = toDomainIncident(id, incident, {
          createdAt: new Date(existing.createdAt),
          updatedAt: now,
          resolvedAt: incident.status === 'RESOLVED' ? now : null,
        });
        this.incidents[index] = updated;
        return updated;
      },
      touch: async () => undefined,
      recordRevisions: async (incidentId, drafts, now) => {
        this.rememberRevisions(incidentId, drafts, now);
      },
      markResolved: async (id, now) => {
        const index = this.incidents.findIndex((item) => item.id === id);
        const existing = this.incidents[index];
        if (!existing) {
          throw new Error(`Incident ${id} not found`);
        }
        const resolved: Incident = {
          ...existing,
          status: 'RESOLVED',
          resolvedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        this.incidents[index] = resolved;
        return resolved;
      },
    };
  }

  private rememberRevisions(incidentId: string, drafts: RevisionDraft[], now: Date): void {
    if (drafts.length === 0) {
      return;
    }
    const recorded = drafts.map((draft) => ({
      id: crypto.randomUUID(),
      recordedAt: now.toISOString(),
      summary: draft.summary,
      field: draft.field,
      previous: draft.previous,
      next: draft.next,
    }));
    const existing = this.revisions.get(incidentId) ?? [];
    this.revisions.set(incidentId, [...recorded, ...existing].slice(0, MAX_REVISIONS));
  }
}

function toMatchFilters(query: IncidentListQuery): IncidentMatchFilters {
  return {
    types: query.types,
    severities: query.severities,
    sources: query.sources,
    startDate: query.startDate?.toISOString() ?? null,
    endDate: query.endDate?.toISOString() ?? null,
    minSeverity: query.minSeverity,
    bbox: query.bbox,
    search: query.search,
    status: query.status,
  };
}

function toMatchFiltersFromStats(query: IncidentStatsQuery): IncidentMatchFilters {
  return {
    types: query.types,
    severities: query.severities,
    sources: query.sources,
    startDate: query.startDate?.toISOString() ?? null,
    endDate: query.endDate?.toISOString() ?? null,
    minSeverity: query.minSeverity,
    bbox: query.bbox,
    search: query.search,
    status: 'ANY',
  };
}

function toSummaryRow(incident: Incident): SummaryRow {
  return {
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    occurredAt: new Date(incident.occurredAt),
  };
}

function compareIncidents(left: Incident, right: Incident, query: IncidentListQuery): number {
  let result = 0;
  if (query.sortBy === 'severity') {
    result = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
  } else if (query.sortBy === 'magnitude') {
    result =
      (left.magnitude ?? Number.NEGATIVE_INFINITY) - (right.magnitude ?? Number.NEGATIVE_INFINITY);
  } else if (query.sortBy === 'updatedAt') {
    result = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
  } else {
    result = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
  }
  if (result === 0) {
    result = left.id.localeCompare(right.id);
  }
  return query.sortOrder === 'asc' ? result : -result;
}
