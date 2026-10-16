import {
  matchesIncident,
  type BoundingBox,
  type Incident,
  type IncidentType,
  type Severity,
} from '@sentinel/shared';

export interface DashboardFilters {
  types: IncidentType[];
  severities: Severity[];
  sources: string[];
  search: string;
  debouncedSearch: string;
  startDate: string;
  endDate: string;
  limitToMapView: boolean;
  bbox: BoundingBox | null;
}

export const emptyFilters: DashboardFilters = {
  types: [],
  severities: [],
  sources: [],
  search: '',
  debouncedSearch: '',
  startDate: '',
  endDate: '',
  limitToMapView: false,
  bbox: null,
};

export function countActiveFilters(filters: DashboardFilters): number {
  return [
    filters.types.length > 0,
    filters.severities.length > 0,
    filters.sources.length > 0,
    filters.search.trim().length > 0,
    filters.startDate.length > 0,
    filters.endDate.length > 0,
    filters.limitToMapView,
  ].filter(Boolean).length;
}

export function incidentMatchesDashboard(incident: Incident, filters: DashboardFilters): boolean {
  return matchesIncident(incident, {
    types: filters.types,
    severities: filters.severities,
    sources: filters.sources,
    search: filters.debouncedSearch.trim() || null,
    startDate: filters.startDate ? `${filters.startDate}T00:00:00.000Z` : null,
    endDate: filters.endDate ? `${filters.endDate}T23:59:59.999Z` : null,
    bbox: filters.limitToMapView ? filters.bbox : null,
    status: 'ACTIVE',
  });
}

export function sameBbox(left: BoundingBox | null, right: BoundingBox | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const epsilon = 0.02;
  return (
    Math.abs(left.minLat - right.minLat) < epsilon &&
    Math.abs(left.maxLat - right.maxLat) < epsilon &&
    Math.abs(left.minLng - right.minLng) < epsilon &&
    Math.abs(left.maxLng - right.maxLng) < epsilon
  );
}

export function buildIncidentSearch(
  filters: DashboardFilters,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams();
  if (filters.types.length > 0) {
    params.set('type', filters.types.join(','));
  }
  if (filters.severities.length > 0) {
    params.set('severity', filters.severities.join(','));
  }
  if (filters.sources.length > 0) {
    params.set('source', filters.sources.join(','));
  }
  if (filters.debouncedSearch.trim()) {
    params.set('search', filters.debouncedSearch.trim());
  }
  if (filters.startDate) {
    params.set('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.set('endDate', filters.endDate);
  }
  if (filters.limitToMapView && filters.bbox) {
    params.set('minLat', String(filters.bbox.minLat));
    params.set('maxLat', String(filters.bbox.maxLat));
    params.set('minLng', String(filters.bbox.minLng));
    params.set('maxLng', String(filters.bbox.maxLng));
  }
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  params.set('sortBy', 'occurredAt');
  params.set('sortOrder', 'desc');
  params.set('status', 'ACTIVE');
  return params.toString();
}
