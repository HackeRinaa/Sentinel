import type { Incident, PaginationMeta, RealtimeEvent } from '@sentinel/shared';

export interface IncidentPage {
  data: Incident[];
  meta: PaginationMeta;
}

type IncidentEvent = Extract<
  RealtimeEvent,
  { type: 'INCIDENT_CREATED' | 'INCIDENT_UPDATED' | 'INCIDENT_REMOVED' }
>;

function pageCount(total: number, pageSize: number): number {
  return total === 0 ? 0 : Math.ceil(total / pageSize);
}

function withTotal(meta: PaginationMeta, total: number): PaginationMeta {
  return { ...meta, total, totalPages: pageCount(total, meta.pageSize) };
}

export function applyIncidentEvent(
  current: IncidentPage | undefined,
  event: IncidentEvent,
  matches: (incident: Incident) => boolean,
): IncidentPage | undefined {
  if (!current) {
    return current;
  }
  const incident = event.payload.incident;
  if (event.type === 'INCIDENT_REMOVED') {
    const relevant = matches({ ...incident, status: 'ACTIVE' });
    const exists = current.data.some((item) => item.id === incident.id);
    if (!relevant && !exists) {
      return current;
    }
    const nextTotal = relevant ? Math.max(0, current.meta.total - 1) : current.meta.total;
    return {
      data: current.data.filter((item) => item.id !== incident.id),
      meta: withTotal(current.meta, nextTotal),
    };
  }

  const exists = current.data.some((item) => item.id === incident.id);
  if (!matches(incident)) {
    if (!exists) {
      return current;
    }
    return {
      data: current.data.filter((item) => item.id !== incident.id),
      meta: withTotal(current.meta, Math.max(0, current.meta.total - 1)),
    };
  }

  if (event.type === 'INCIDENT_UPDATED') {
    if (!exists) {
      return current;
    }
    return {
      data: current.data.map((item) => (item.id === incident.id ? incident : item)),
      meta: current.meta,
    };
  }

  if (exists) {
    return current;
  }
  const data =
    current.meta.page === 1
      ? [incident, ...current.data].slice(0, current.meta.pageSize)
      : current.data;
  return {
    data,
    meta: withTotal(current.meta, current.meta.total + 1),
  };
}
