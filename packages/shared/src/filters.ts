import {
  incidentPlace,
  meetsMinSeverity,
  type Incident,
  type IncidentStatus,
  type IncidentType,
  type Severity,
} from './incident.js';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface IncidentMatchFilters {
  types?: IncidentType[];
  severities?: Severity[];
  sources?: string[];
  startDate?: string | null;
  endDate?: string | null;
  minSeverity?: Severity | null;
  bbox?: BoundingBox | null;
  search?: string | null;
  status?: IncidentStatus | 'ANY';
}

function includesWhenPresent<T>(selected: T[] | undefined, value: T): boolean {
  return !selected || selected.length === 0 || selected.includes(value);
}

export function matchesIncident(incident: Incident, filters: IncidentMatchFilters): boolean {
  if (filters.status && filters.status !== 'ANY' && incident.status !== filters.status) {
    return false;
  }
  if (!includesWhenPresent(filters.types, incident.type)) {
    return false;
  }
  if (!includesWhenPresent(filters.severities, incident.severity)) {
    return false;
  }
  if (!includesWhenPresent(filters.sources, incident.source)) {
    return false;
  }
  if (filters.minSeverity && !meetsMinSeverity(incident.severity, filters.minSeverity)) {
    return false;
  }
  if (filters.startDate && incident.occurredAt < filters.startDate) {
    return false;
  }
  if (filters.endDate && incident.occurredAt > filters.endDate) {
    return false;
  }
  if (filters.bbox) {
    const { minLat, maxLat, minLng, maxLng } = filters.bbox;
    if (
      incident.latitude < minLat ||
      incident.latitude > maxLat ||
      incident.longitude < minLng ||
      incident.longitude > maxLng
    ) {
      return false;
    }
  }
  const search = filters.search?.trim().toLowerCase();
  if (search) {
    const haystack =
      `${incident.title} ${incident.description} ${incidentPlace(incident)}`.toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }
  return true;
}
