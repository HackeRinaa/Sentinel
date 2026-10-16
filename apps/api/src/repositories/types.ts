import type {
  BoundingBox,
  Incident,
  IncidentDetail,
  IncidentStats,
  IncidentStatus,
  IncidentType,
  NearbyIncident,
  PaginationMeta,
  Severity,
} from '@sentinel/shared';
import type { NormalizedIncident } from '../providers/types.js';

export type IncidentSortField = 'occurredAt' | 'updatedAt' | 'severity' | 'magnitude';

export interface IncidentListQuery {
  types: IncidentType[];
  severities: Severity[];
  sources: string[];
  startDate: Date | null;
  endDate: Date | null;
  minSeverity: Severity | null;
  bbox: BoundingBox | null;
  search: string | null;
  page: number;
  pageSize: number;
  sortBy: IncidentSortField;
  sortOrder: 'asc' | 'desc';
  status: IncidentStatus | 'ANY';
}

export interface IncidentStatsQuery {
  types: IncidentType[];
  severities: Severity[];
  sources: string[];
  startDate: Date | null;
  endDate: Date | null;
  minSeverity: Severity | null;
  bbox: BoundingBox | null;
  search: string | null;
}

export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
  limit: number;
}

export interface PaginatedIncidents {
  items: Incident[];
  meta: PaginationMeta;
}

export interface SyncResult {
  created: Incident[];
  updated: Incident[];
  removed: Incident[];
  received: number;
}

export interface IncidentRepository {
  applySnapshot(
    source: string,
    incidents: NormalizedIncident[],
    options: { allowRemovals: boolean },
  ): Promise<SyncResult>;
  list(query: IncidentListQuery): Promise<PaginatedIncidents>;
  findById(id: string): Promise<IncidentDetail | null>;
  stats(query: IncidentStatsQuery): Promise<IncidentStats>;
  nearby(query: NearbyQuery): Promise<NearbyIncident[]>;
  countActiveBySource(source: string): Promise<number>;
}
