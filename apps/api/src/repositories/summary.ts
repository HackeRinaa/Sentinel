import {
  INCIDENT_TYPES,
  SEVERITIES,
  type IncidentStats,
  type IncidentStatus,
  type IncidentType,
  type Severity,
} from '@sentinel/shared';
import type { IncidentStatsQuery } from './types.js';

export interface SummaryRow {
  type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  occurredAt: Date;
}

export function resolveTimelineWindow(
  query: Pick<IncidentStatsQuery, 'startDate' | 'endDate'>,
  now: Date,
): { start: Date; end: Date } {
  const end = query.endDate ?? now;
  let start = query.startDate ?? new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  const maxSpan = 31 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxSpan) {
    start = new Date(end.getTime() - maxSpan);
  }
  if (start > end) {
    start = new Date(end.getTime());
  }
  return { start, end };
}

export function buildTimeline(dates: Date[], start: Date, end: Date): IncidentStats['timeline'] {
  const counts = new Map<string, number>();
  const cursor = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cursor.getTime() <= last.getTime()) {
    counts.set(toBucket(cursor), 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const date of dates) {
    const key = toBucket(startOfUtcDay(date));
    if (!counts.has(key)) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([bucket, count]) => ({ bucket, count }));
}

export function summarizeIncidents(
  rows: SummaryRow[],
  query: IncidentStatsQuery,
  now: Date,
): IncidentStats {
  const activeRows = rows.filter((row) => row.status === 'ACTIVE');
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const window = resolveTimelineWindow(query, now);
  const typeCounts = new Map<IncidentType, number>();
  const severityCounts = new Map<Severity, number>();
  for (const row of activeRows) {
    typeCounts.set(row.type, (typeCounts.get(row.type) ?? 0) + 1);
    severityCounts.set(row.severity, (severityCounts.get(row.severity) ?? 0) + 1);
  }

  return {
    active: activeRows.length,
    critical: activeRows.filter((row) => row.severity === 'CRITICAL').length,
    last24h: rows.filter((row) => row.occurredAt >= dayAgo).length,
    byType: INCIDENT_TYPES.map((type) => ({ type, count: typeCounts.get(type) ?? 0 })),
    bySeverity: SEVERITIES.map((severity) => ({
      severity,
      count: severityCounts.get(severity) ?? 0,
    })),
    timeline: buildTimeline(
      rows
        .filter((row) => row.occurredAt >= window.start && row.occurredAt <= window.end)
        .map((row) => row.occurredAt),
      window.start,
      window.end,
    ),
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}
