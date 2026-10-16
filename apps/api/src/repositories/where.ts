import {
  meetsMinSeverity,
  SEVERITIES,
  type IncidentStatus,
  type IncidentType,
  type Severity,
} from '@sentinel/shared';
import type { Prisma } from '@prisma/client';
import type { BoundingBox } from '@sentinel/shared';

export interface WhereFilters {
  types: IncidentType[];
  severities: Severity[];
  sources: string[];
  startDate: Date | null;
  endDate: Date | null;
  minSeverity: Severity | null;
  bbox: BoundingBox | null;
  search: string | null;
  status?: IncidentStatus | 'ANY';
}

export function buildIncidentWhere(filters: WhereFilters): Prisma.IncidentWhereInput {
  const where: Prisma.IncidentWhereInput = {};
  if (filters.status && filters.status !== 'ANY') {
    where.status = filters.status;
  }
  if (filters.types.length > 0) {
    where.type = { in: filters.types };
  }
  if (filters.sources.length > 0) {
    where.source = { in: filters.sources };
  }

  const severityConstraint = resolveSeverities(filters);
  if (severityConstraint && severityConstraint.length === 0) {
    where.id = '__no_match__';
  } else if (severityConstraint) {
    where.severity = { in: severityConstraint };
  }

  if (filters.startDate || filters.endDate) {
    where.occurredAt = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }
  if (filters.bbox) {
    where.latitude = { gte: filters.bbox.minLat, lte: filters.bbox.maxLat };
    where.longitude = { gte: filters.bbox.minLng, lte: filters.bbox.maxLng };
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

function resolveSeverities(filters: WhereFilters): Severity[] | null {
  const minimum = filters.minSeverity
    ? SEVERITIES.filter((severity) => meetsMinSeverity(severity, filters.minSeverity as Severity))
    : null;
  if (filters.severities.length === 0 && !minimum) {
    return null;
  }
  if (!minimum) {
    return filters.severities;
  }
  if (filters.severities.length === 0) {
    return [...minimum];
  }
  return filters.severities.filter((severity) => minimum.includes(severity));
}
